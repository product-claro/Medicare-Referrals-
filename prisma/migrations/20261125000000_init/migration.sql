-- =====================================================================
-- Referidos de clinicas para Medicare - MVP
-- Postgres 14+ (recomendado 16). Convencion: snake_case, PK uuid, timestamptz en UTC.
--
-- CUMPLIMIENTO (decision tomada, no se renegocia):
--   * NO existe ninguna columna para MBI (numero de Medicare) ni Medicaid.
--   * Paciente = nombre, apellido, telefono, clinica (automatica segun quien crea).
--   * contains_mbi() bloquea que un MBI se cuele por texto libre (nombres, motivos, notas, json).
--
-- AUDITORIA:
--   * El actor de cada escritura llega por set_config('app.actor_user_id', <uuid>, true)
--     dentro de la misma transaccion. Sin actor, la escritura en referrals falla.
--   * Los triggers rellenan created_by / assigned_by / closed_by y sus timestamps
--     (no se pueden falsificar desde la app) y escriben referral_events (append-only).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() en PG < 13

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
CREATE TYPE user_role           AS ENUM ('clinica', 'maestro', 'productor');
CREATE TYPE app_locale          AS ENUM ('es', 'en');
-- Productor siempre es una persona individual. No existe el valor 'agencia'.
CREATE TYPE producer_type       AS ENUM ('dependiente', 'independiente');
CREATE TYPE referral_status     AS ENUM ('nuevo', 'asignado', 'contactado', 'sin_contacto', 'inscrito', 'no_inscrito');
CREATE TYPE referral_event_type AS ENUM ('creado', 'asignado', 'reasignado', 'contactado', 'sin_contacto', 'inscrito', 'no_inscrito', 'actualizado');

-- ---------------------------------------------------------------------
-- Funciones utilitarias
-- ---------------------------------------------------------------------

-- Detecta un MBI (formato CMS de 11 caracteres) aunque venga con espacios o guiones.
-- Letras permitidas en MBI: A-Z excepto S, L, O, I, B, Z.
CREATE OR REPLACE FUNCTION contains_mbi(t text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT t IS NOT NULL
     AND upper(regexp_replace(t, '[^A-Za-z0-9]', '', 'g'))
         ~ '[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9][0-9][AC-HJKMNP-RT-Y]{2}[0-9]{2}'
$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Para tablas append-only (auditoria).
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

-- Actor de la transaccion actual (lo fija la app con set_config(..., true)).
CREATE OR REPLACE FUNCTION app_actor() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text := current_setting('app.actor_user_id', true);
BEGIN
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'audit_actor_missing' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v::uuid;
END $$;

-- ---------------------------------------------------------------------
-- clinics
-- ---------------------------------------------------------------------
CREATE TABLE clinics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_clinics_name ON clinics (lower(name));
CREATE TRIGGER trg_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- producers (siempre persona individual: dependiente o independiente)
-- ---------------------------------------------------------------------
CREATE TABLE producers (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text          NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 160),
  producer_type producer_type NOT NULL,
  npn           text          NULL UNIQUE CHECK (npn ~ '^[0-9]{1,10}$'), -- National Producer Number (licencia del agente, no dato del paciente)
  phone         text          NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  active        boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_producers_updated_at BEFORE UPDATE ON producers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- users (login propio email/password; sin auto-registro: los crea el maestro)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text        NOT NULL CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash         text        NOT NULL,              -- formato: scrypt$N$r$p$salt_b64$hash_b64
  full_name             text        NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 160),
  role                  user_role   NOT NULL,
  clinic_id             uuid        NULL REFERENCES clinics(id),
  producer_id           uuid        NULL UNIQUE REFERENCES producers(id),
  locale                app_locale  NOT NULL DEFAULT 'es',
  active                boolean     NOT NULL DEFAULT true,
  must_change_password  boolean     NOT NULL DEFAULT true,
  failed_login_count    integer     NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until          timestamptz NULL,
  last_login_at         timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_users_role_scope CHECK (
       (role = 'clinica'   AND clinic_id IS NOT NULL AND producer_id IS NULL)
    OR (role = 'productor' AND producer_id IS NOT NULL AND clinic_id IS NULL)
    OR (role = 'maestro'   AND clinic_id IS NULL AND producer_id IS NULL)
  )
);
CREATE UNIQUE INDEX ux_users_email ON users (email);
CREATE INDEX ix_users_clinic ON users (clinic_id) WHERE clinic_id IS NOT NULL;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- sessions (el id viaja firmado dentro de la cookie; permite revocar/logout)
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz NULL,
  user_agent    text        NULL CHECK (char_length(user_agent) <= 400),
  ip            inet        NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX ix_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- close_reasons (catalogo de motivos; todo estado final exige uno)
-- ---------------------------------------------------------------------
CREATE TABLE close_reasons (
  code             text            PRIMARY KEY CHECK (code ~ '^[a-z_]{2,40}$'),
  applies_to       referral_status NOT NULL CHECK (applies_to IN ('inscrito', 'no_inscrito')),
  label_es         text            NOT NULL,
  label_en         text            NOT NULL,
  requires_detail  boolean         NOT NULL DEFAULT false,  -- p.ej. 'otro' exige texto
  sort_order       integer         NOT NULL DEFAULT 100,
  active           boolean         NOT NULL DEFAULT true,
  CONSTRAINT ux_close_reasons_code_state UNIQUE (code, applies_to)
);

-- ---------------------------------------------------------------------
-- referrals (paciente referido). SIN MBI / SIN Medicaid.
-- ---------------------------------------------------------------------
CREATE TABLE referrals (
  id                   uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number           bigint          GENERATED ALWAYS AS IDENTITY UNIQUE, -- numero corto para hablar por telefono (R-000123)
  clinic_id            uuid            NOT NULL REFERENCES clinics(id),     -- lo fija el trigger segun el usuario creador
  first_name           text            NOT NULL CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 80 AND NOT contains_mbi(first_name)),
  last_name            text            NOT NULL CHECK (char_length(btrim(last_name))  BETWEEN 1 AND 80 AND NOT contains_mbi(last_name)),
  phone                text            NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'), -- E.164
  status               referral_status NOT NULL DEFAULT 'nuevo',
  producer_id          uuid            NULL REFERENCES producers(id),       -- siempre un productor individual
  contact_attempts     integer         NOT NULL DEFAULT 0 CHECK (contact_attempts >= 0),

  -- Cierre
  close_reason_code    text            NULL,
  close_reason_detail  text            NULL CHECK (char_length(close_reason_detail) <= 500 AND NOT contains_mbi(close_reason_detail)),
  plan_name            text            NULL CHECK (char_length(btrim(plan_name)) BETWEEN 1 AND 200 AND NOT contains_mbi(plan_name)),
  enrollment_date      date            NULL,
  effective_date       date            NULL,

  -- Auditoria denormalizada (la rellenan los triggers)
  created_by_user_id   uuid            NOT NULL REFERENCES users(id),
  created_at           timestamptz     NOT NULL DEFAULT now(),
  assigned_by_user_id  uuid            NULL REFERENCES users(id),
  assigned_at          timestamptz     NULL,
  closed_by_user_id    uuid            NULL REFERENCES users(id),
  closed_at            timestamptz     NULL,
  updated_at           timestamptz     NOT NULL DEFAULT now(),
  version              integer         NOT NULL DEFAULT 1,                  -- concurrencia optimista

  -- El motivo debe pertenecer al estado final correspondiente.
  CONSTRAINT fk_referrals_close_reason
    FOREIGN KEY (close_reason_code, status) REFERENCES close_reasons (code, applies_to),

  -- 'nuevo' = sin productor; cualquier otro estado = con productor y con quien/cuando asigno.
  CONSTRAINT ck_referrals_assignment CHECK (
       (status = 'nuevo'  AND producer_id IS NULL AND assigned_by_user_id IS NULL AND assigned_at IS NULL)
    OR (status <> 'nuevo' AND producer_id IS NOT NULL AND assigned_by_user_id IS NOT NULL AND assigned_at IS NOT NULL)
  ),

  -- Ningun referido se cierra sin motivo (criterio 6) y sin quien/cuando cerro (criterio 9).
  CONSTRAINT ck_referrals_close CHECK (
       (status IN ('inscrito', 'no_inscrito')
          AND close_reason_code IS NOT NULL AND closed_by_user_id IS NOT NULL AND closed_at IS NOT NULL)
    OR (status NOT IN ('inscrito', 'no_inscrito')
          AND close_reason_code IS NULL AND close_reason_detail IS NULL
          AND closed_by_user_id IS NULL AND closed_at IS NULL)
  ),

  -- Inscrito lleva plan, fecha de inscripcion y fecha efectiva (criterio 7).
  CONSTRAINT ck_referrals_enrollment CHECK (
       (status = 'inscrito'
          AND plan_name IS NOT NULL AND enrollment_date IS NOT NULL AND effective_date IS NOT NULL
          AND effective_date >= enrollment_date)
    OR (status <> 'inscrito'
          AND plan_name IS NULL AND enrollment_date IS NULL AND effective_date IS NULL)
  )
);

CREATE INDEX ix_referrals_unassigned      ON referrals (created_at) WHERE status = 'nuevo';     -- bandeja del maestro
CREATE INDEX ix_referrals_clinic_created  ON referrals (clinic_id, created_at DESC);             -- vista de la clinica
CREATE INDEX ix_referrals_producer_status ON referrals (producer_id, status);                    -- vista del productor
CREATE INDEX ix_referrals_status          ON referrals (status);
CREATE INDEX ix_referrals_created_at      ON referrals (created_at);

-- ---------------------------------------------------------------------
-- referral_events (historial append-only: quien creo, asigno, contacto, cerro y cuando)
-- ---------------------------------------------------------------------
CREATE TABLE referral_events (
  id                bigint              GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referral_id       uuid                NOT NULL REFERENCES referrals(id) ON DELETE RESTRICT,
  event_type        referral_event_type NOT NULL,
  actor_user_id     uuid                NOT NULL REFERENCES users(id),
  actor_role        user_role           NOT NULL,
  from_status       referral_status     NULL,
  to_status         referral_status     NOT NULL,
  from_producer_id  uuid                NULL REFERENCES producers(id),
  to_producer_id    uuid                NULL REFERENCES producers(id),
  close_reason_code text                NULL REFERENCES close_reasons(code),
  detail            text                NULL CHECK (char_length(detail) <= 500 AND NOT contains_mbi(detail)),
  data              jsonb               NOT NULL DEFAULT '{}'::jsonb CHECK (NOT contains_mbi(data::text)), -- p.ej. {"form_duration_ms": 23000}
  occurred_at       timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX ix_referral_events_referral ON referral_events (referral_id, occurred_at);
CREATE INDEX ix_referral_events_actor    ON referral_events (actor_user_id, occurred_at);
CREATE TRIGGER trg_referral_events_immutable BEFORE UPDATE OR DELETE ON referral_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------
-- notifications (aviso al productor al momento de la asignacion; nunca lleva MBI)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id  uuid        NOT NULL REFERENCES users(id),
  referral_id        uuid        NULL REFERENCES referrals(id),
  kind               text        NOT NULL CHECK (kind IN ('referral_assigned', 'referral_unassigned')),
  params             jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (NOT contains_mbi(params::text)), -- se renderiza con el diccionario del idioma del receptor
  created_at         timestamptz NOT NULL DEFAULT now(),
  read_at            timestamptz NULL,
  email_sent_at      timestamptz NULL,   -- email opcional y generico (sin datos del paciente)
  email_error        text        NULL
);
CREATE INDEX ix_notifications_unread ON notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX ix_notifications_email_pending ON notifications (created_at) WHERE email_sent_at IS NULL;

-- ---------------------------------------------------------------------
-- audit_log (acciones administrativas y de autenticacion; append-only)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id  uuid        NULL REFERENCES users(id),   -- NULL en login fallido de email desconocido
  action         text        NOT NULL CHECK (action ~ '^[a-z_.]{3,60}$'), -- login.success, login.failed, user.created, user.deactivated, password.reset, producer.created, clinic.created ...
  entity_type    text        NULL,
  entity_id      uuid        NULL,
  data           jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (NOT contains_mbi(data::text)),
  ip             inet        NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_log_occurred ON audit_log (occurred_at DESC);
CREATE INDEX ix_audit_log_entity   ON audit_log (entity_type, entity_id);
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------
-- Reglas de negocio de referrals (BEFORE): actor, alcance, transiciones, motivos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION referrals_before_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_actor            uuid := app_actor();
  v_role             user_role;
  v_clinic           uuid;
  v_producer         uuid;
  v_active           boolean;
  v_requires_detail  boolean;
BEGIN
  SELECT role, clinic_id, producer_id, active
    INTO v_role, v_clinic, v_producer, v_active
    FROM users WHERE id = v_actor;
  IF v_role IS NULL OR NOT v_active THEN
    RAISE EXCEPTION 'audit_actor_invalid' USING ERRCODE = 'check_violation';
  END IF;

  -- ---------- INSERT: solo la clinica crea; la clinica es automatica ----------
  IF TG_OP = 'INSERT' THEN
    IF v_role <> 'clinica' THEN
      RAISE EXCEPTION 'only_clinic_creates_referrals' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status <> 'nuevo' OR NEW.producer_id IS NOT NULL THEN
      RAISE EXCEPTION 'referral_must_start_as_nuevo' USING ERRCODE = 'check_violation';
    END IF;
    NEW.clinic_id          := v_clinic;
    NEW.created_by_user_id := v_actor;
    NEW.created_at         := now();
    NEW.updated_at         := now();
    NEW.version            := 1;
    RETURN NEW;
  END IF;

  -- ---------- UPDATE ----------
  IF NEW.clinic_id <> OLD.clinic_id
     OR NEW.created_by_user_id <> OLD.created_by_user_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'referral_immutable_field' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status IN ('inscrito', 'no_inscrito') THEN
    RAISE EXCEPTION 'referral_already_closed' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
       (OLD.status = 'nuevo' AND NEW.status = 'asignado')
    OR (OLD.status IN ('asignado', 'contactado', 'sin_contacto')
        AND NEW.status IN ('asignado', 'contactado', 'sin_contacto', 'inscrito', 'no_inscrito'))
  ) THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = 'check_violation',
      DETAIL = format('%s -> %s', OLD.status, NEW.status);
  END IF;

  -- Asignacion / reasignacion: solo maestro, manual, a un productor individual activo.
  IF NEW.producer_id IS DISTINCT FROM OLD.producer_id THEN
    IF v_role <> 'maestro' THEN
      RAISE EXCEPTION 'only_master_assigns' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.producer_id IS NULL THEN
      RAISE EXCEPTION 'cannot_unassign' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM producers WHERE id = NEW.producer_id AND active) THEN
      RAISE EXCEPTION 'producer_inactive_or_unknown' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status <> 'asignado' THEN
      RAISE EXCEPTION 'assignment_must_set_status_asignado' USING ERRCODE = 'check_violation';
    END IF;
    NEW.assigned_by_user_id := v_actor;
    NEW.assigned_at         := now();
  ELSIF NEW.status = 'asignado' AND OLD.status <> 'asignado' THEN
    RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = 'check_violation',
      DETAIL = format('%s -> asignado without producer change', OLD.status);
  END IF;

  -- Trabajo del referido: solo el productor asignado (o el maestro en su nombre).
  IF NEW.status IN ('contactado', 'sin_contacto', 'inscrito', 'no_inscrito')
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.contact_attempts <> OLD.contact_attempts) THEN
    IF NOT (v_role = 'maestro' OR (v_role = 'productor' AND v_producer = NEW.producer_id)) THEN
      RAISE EXCEPTION 'actor_not_assigned_producer' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Cierre: motivo obligatorio, del estado correcto, activo; detalle si el motivo lo exige.
  IF NEW.status IN ('inscrito', 'no_inscrito') THEN
    SELECT requires_detail INTO v_requires_detail
      FROM close_reasons
     WHERE code = NEW.close_reason_code AND applies_to = NEW.status AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'close_reason_required' USING ERRCODE = 'check_violation';
    END IF;
    IF v_requires_detail AND coalesce(btrim(NEW.close_reason_detail), '') = '' THEN
      RAISE EXCEPTION 'close_reason_detail_required' USING ERRCODE = 'check_violation';
    END IF;
    NEW.closed_by_user_id := v_actor;
    NEW.closed_at         := now();
  END IF;

  NEW.version    := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_referrals_before_write
  BEFORE INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION referrals_before_write();

CREATE TRIGGER trg_referrals_no_delete
  BEFORE DELETE ON referrals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------
-- Historial + aviso al productor (AFTER)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION referrals_after_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_actor        uuid := app_actor();
  v_role         user_role;
  v_type         referral_event_type;
  v_note         text  := nullif(current_setting('app.event_note', true), '');
  v_data         jsonb := coalesce(nullif(current_setting('app.event_data', true), '')::jsonb, '{}'::jsonb);
  v_clinic_name  text;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = v_actor;

  IF TG_OP = 'INSERT' THEN
    v_type := 'creado';
  ELSIF NEW.producer_id IS DISTINCT FROM OLD.producer_id THEN
    v_type := CASE WHEN OLD.producer_id IS NULL THEN 'asignado' ELSE 'reasignado' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.contact_attempts <> OLD.contact_attempts THEN
    v_type := NEW.status::text::referral_event_type;
  ELSE
    v_type := 'actualizado';
  END IF;

  INSERT INTO referral_events (
    referral_id, event_type, actor_user_id, actor_role,
    from_status, to_status, from_producer_id, to_producer_id,
    close_reason_code, detail, data)
  VALUES (
    NEW.id, v_type, v_actor, v_role,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.producer_id END, NEW.producer_id,
    CASE WHEN NEW.status IN ('inscrito', 'no_inscrito') THEN NEW.close_reason_code END,
    v_note, v_data);

  -- Aviso inmediato (en la misma transaccion) al productor asignado. Sin MBI: no existe en el modelo.
  IF TG_OP = 'UPDATE' AND NEW.producer_id IS DISTINCT FROM OLD.producer_id THEN
    SELECT name INTO v_clinic_name FROM clinics WHERE id = NEW.clinic_id;

    INSERT INTO notifications (recipient_user_id, referral_id, kind, params)
    SELECT u.id, NEW.id, 'referral_assigned',
           jsonb_build_object(
             'ref_number',         NEW.ref_number,
             'clinic_name',        v_clinic_name,
             'patient_short_name', NEW.first_name || ' ' || left(NEW.last_name, 1) || '.')
      FROM users u
     WHERE u.producer_id = NEW.producer_id AND u.active;

    IF OLD.producer_id IS NOT NULL THEN
      INSERT INTO notifications (recipient_user_id, referral_id, kind, params)
      SELECT u.id, NEW.id, 'referral_unassigned', jsonb_build_object('ref_number', NEW.ref_number)
        FROM users u
       WHERE u.producer_id = OLD.producer_id AND u.active;
    END IF;
  END IF;

  RETURN NULL;
END $$;

CREATE TRIGGER trg_referrals_after_write
  AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION referrals_after_write();

-- ---------------------------------------------------------------------
-- Metricas (criterio 8). Tasa de cierre = inscritos / llegados (comparable con la linea base 60/250 = 24% y la meta 40%).
-- Para rangos de fecha la API usa la misma consulta parametrizada por created_at.
-- ---------------------------------------------------------------------
CREATE VIEW v_metrics_by_clinic AS
SELECT
  c.id   AS clinic_id,
  c.name AS clinic_name,
  count(r.id)                                                              AS arrived,
  count(r.id) FILTER (WHERE r.status = 'nuevo')                             AS unassigned,
  count(r.id) FILTER (WHERE r.status IN ('asignado','contactado','sin_contacto')) AS in_progress,
  count(r.id) FILTER (WHERE r.status IN ('inscrito','no_inscrito'))         AS closed,
  count(r.id) FILTER (WHERE r.status = 'inscrito')                          AS enrolled,
  count(r.id) FILTER (WHERE r.status = 'no_inscrito')                       AS not_enrolled,
  round(100.0 * count(r.id) FILTER (WHERE r.status = 'inscrito') / nullif(count(r.id), 0), 1) AS close_rate_pct
FROM clinics c
LEFT JOIN referrals r ON r.clinic_id = c.id
GROUP BY c.id, c.name;

CREATE VIEW v_metrics_by_producer AS
SELECT
  p.id            AS producer_id,
  p.full_name     AS producer_name,
  p.producer_type AS producer_type,
  count(r.id)                                                              AS arrived,   -- asignados actualmente a este productor
  count(r.id) FILTER (WHERE r.status IN ('asignado','contactado','sin_contacto')) AS in_progress,
  count(r.id) FILTER (WHERE r.status IN ('inscrito','no_inscrito'))         AS closed,
  count(r.id) FILTER (WHERE r.status = 'inscrito')                          AS enrolled,
  count(r.id) FILTER (WHERE r.status = 'no_inscrito')                       AS not_enrolled,
  round(100.0 * count(r.id) FILTER (WHERE r.status = 'inscrito') / nullif(count(r.id), 0), 1) AS close_rate_pct
FROM producers p
LEFT JOIN referrals r ON r.producer_id = p.id
GROUP BY p.id, p.full_name, p.producer_type;

-- ---------------------------------------------------------------------
-- Datos de referencia (van en la migracion, no en el seed de ejemplo)
-- ---------------------------------------------------------------------
INSERT INTO close_reasons (code, applies_to, label_es, label_en, requires_detail, sort_order) VALUES
  ('inscrito_en_plan',   'inscrito',    'Inscrito en un plan',          'Enrolled in a plan',                  false, 10),
  ('no_contesto',        'no_inscrito', 'No contesto',                  'No answer',                           false, 10),
  ('numero_equivocado',  'no_inscrito', 'Numero equivocado',            'Wrong number',                        false, 20),
  ('no_pidio_nada',      'no_inscrito', 'Dijo que no pidio nada',       'Said they did not request anything',  false, 30),
  ('no_califica',        'no_inscrito', 'No califica',                  'Not eligible',                        false, 40),
  ('eligio_otro_agente', 'no_inscrito', 'Eligio otro agente',           'Chose another agent',                 false, 50),
  ('otro',               'no_inscrito', 'Otro (especificar)',           'Other (please specify)',              true,  90);

-- ---------------------------------------------------------------------
-- Permisos sugeridos: la app se conecta con un rol sin UPDATE/DELETE sobre auditoria.
-- ---------------------------------------------------------------------
-- CREATE ROLE referrals_app LOGIN PASSWORD '<desde el gestor de secretos>';
-- GRANT SELECT, INSERT, UPDATE ON clinics, producers, users, sessions, referrals, notifications TO referrals_app;
-- GRANT SELECT ON close_reasons, v_metrics_by_clinic, v_metrics_by_producer TO referrals_app;
-- GRANT SELECT, INSERT ON referral_events, audit_log TO referrals_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO referrals_app;
