# Referidos de clinicas para Medicare (MVP) - Claro Insurance

Next.js 14 (App Router, TypeScript) + Prisma + Postgres 16 + Tailwind CSS + zod.
Autenticacion propia por cookie de sesion (sin NextAuth). Idiomas es/en con diccionarios JSON.

**Cumplimiento:** no se guarda numero de Medicare (MBI) ni Medicaid. No hay columnas para ellos.

## Requisitos

- Node.js 20+
- Postgres 14+ (recomendado 16)

## Instalacion

```bash
npm install
cp .env.example .env        # en Windows PowerShell: Copy-Item .env.example .env
```

Edita `.env`:

- `DATABASE_URL` / `DIRECT_URL`: conexion a tu Postgres (ver "Base de datos" abajo; en Supabase son distintas).
- `SESSION_SECRET`: 32+ bytes aleatorios (`openssl rand -base64 48`).
- `SEED_DEFAULT_PASSWORD`: contrasena inicial de los usuarios del seed (min. 10 caracteres).
- `APP_URL`, `APP_TIMEZONE`, `CRON_SECRET`.

## Base de datos

La migracion inicial (`prisma/migrations/20261125000000_init/migration.sql`) ya esta escrita a mano y
completa: tipos, tablas, CHECK, triggers, funciones (`contains_mbi`, `set_updated_at`, `forbid_mutation`,
`app_actor`), indices (incluidos los parciales y `ux_clinics_name ON clinics (lower(name))`), la FK compuesta
`fk_referrals_close_reason`, las columnas `GENERATED ALWAYS AS IDENTITY` (`ref_number`, ids de
`referral_events` / `audit_log`), las vistas `v_metrics_by_clinic` / `v_metrics_by_producer` y el catalogo
`close_reasons`. No hace falta generarla con `prisma migrate dev`, porque Prisma no modela nada de eso.
Verificada end-to-end contra Postgres 16 real (migracion + seed + login + las 3 vistas por rol).

```bash
npx prisma migrate deploy   # aplica la migracion tal cual esta en el repo
npx prisma db seed          # solo desarrollo/staging: 1 maestro, 3 clinicas, 4 productores, 22 referidos de ejemplo
```

Reglas: en CI y produccion solo `prisma migrate deploy`. `prisma db push` esta prohibido.
Si mas adelante agregas una migracion nueva con `prisma migrate dev`, Prisma puede reportar "deriva" porque
el `schema.prisma` no declara los CHECK/triggers/vistas que si existen en la base: es esperado, no la
"arregles" aceptando que Prisma los elimine; escribe la migracion nueva a mano como esta, revisando el SQL
que proponga antes de aplicar.

### Con Supabase

`schema.prisma` declara `url = DATABASE_URL` (runtime) y `directUrl = DIRECT_URL` (solo migraciones).
En Project Settings > Database de Supabase:

- `DATABASE_URL` = cadena del **pooler** (puerto 6543, "Transaction" mode) + `?pgbouncer=true`. La usa la
  app en runtime; el pooler es obligatorio en Vercel porque cada invocacion serverless abre su propia
  conexion y Postgres tiene un limite bajo de conexiones directas.
- `DIRECT_URL` = cadena **directa** (puerto 5432). `prisma migrate deploy` la necesita porque el pooler en
  modo transaction no soporta prepared statements.

## Despliegue (Vercel + Supabase)

1. Crea el proyecto en Supabase y copia ambas cadenas de conexion (ver arriba).
2. En Vercel, importa este repositorio y agrega las variables de entorno de `.env.example`
   (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `APP_URL` con el dominio real de Vercel, `APP_TIMEZONE`,
   `CRON_SECRET`; `SEED_DEFAULT_PASSWORD` y el `SMTP_*` son opcionales, no hace falta en produccion).
3. El script `vercel-build` (`prisma generate && prisma migrate deploy && next build`) corre en cada deploy:
   aplica la migracion inicial automaticamente contra `DIRECT_URL`, sin pasos manuales.
4. Primer deploy: entra como `maestro` (crealo a mano en la base, por SQL, ya que el seed no corre en
   produccion) y usa las pantallas de Productores/Clinicas para dar de alta al resto. Alternativa rapida
   para un ambiente de prueba: corre `npx prisma db seed` una vez, en local, apuntando `DATABASE_URL` a
   Supabase (`SEED_DEFAULT_PASSWORD` debe estar definido y `NODE_ENV` no debe ser `production`).
5. `APP_URL` debe coincidir exactamente con el dominio que usan los usuarios (el middleware compara el
   header `Origin` contra el, ver "Decisiones de cumplimiento"); si usas un dominio de preview de Vercel
   distinto al de produccion, cada uno necesita su propio `APP_URL`.

## Desarrollo

```bash
npm run dev                 # http://localhost:3000
npm run typecheck
npm test                    # vitest
npm run test:e2e            # playwright (flujos moviles)
```

## Usuarios del seed (la contrasena es `SEED_DEFAULT_PASSWORD`; deben cambiarla al entrar)

| Rol | Correo |
| --- | --- |
| maestro | dave@claro-demo.example |
| clinica | norte@clinica-demo.example, centro@clinica-demo.example, sur@clinica-demo.example |
| productor | productor1..4@claro-demo.example (2 dependientes, 2 independientes) |

El seed no corre con `NODE_ENV=production`.

## Estructura

```
prisma/            schema.prisma, seed.ts, migrations/
src/app/           (public)/login, clinica/, maestro/, productor/, api/
src/components/    componentes compartidos
src/lib/           db.ts, auth/, referrals/ (service, scope, schemas, transitions), errors.ts
src/i18n/          config.ts, dictionaries/{es,en}.json
```

## Resumen del MVP

Claro Insurance recibe pacientes referidos por clinicas para Medicare. Flujo:

1. **Clinica** (`/clinica`): registra un paciente con 3 campos (nombre, apellido, telefono) desde el telefono, en menos de 1 minuto
   (`form_duration_ms` queda en el evento `creado`). Ve solo sus referidos (`/clinica/referidos`) con el resultado: plan, fechas y
   productor si se inscribio; motivo si no.
2. **Maestro** (Dave, `/maestro`): bandeja unica de referidos sin asignar de todas las clinicas; asigna a mano a un productor
   individual activo en 2 pasos (elegir + confirmar). Tambien reasigna, ve la linea de tiempo de auditoria, metricas
   (llegados, sin asignar, en proceso, cerrados, inscritos, tasa de cierre vs. meta 40%) y administra productores
   (`/maestro/productores`, alta individual o masiva por Excel con plantilla descargable) y clinicas (`/maestro/clinicas`).
3. **Productor** (`/productor`): lista de referidos asignados (activos primero), boton de llamada, registra contacto
   (Contactado / Sin contacto) y cierra: Inscrito (plan, fecha de inscripcion, fecha efectiva) o No inscrito (motivo obligatorio;
   detalle si el motivo es "Otro"). Recibe avisos de asignacion/reasignacion (`/productor/avisos`) con badge que se actualiza cada 20 s.

Estados: `nuevo -> asignado -> contactado | sin_contacto -> inscrito | no_inscrito`. Los dos ultimos son finales e inmutables en el MVP
(reabrir o corregir queda fuera de alcance). Ningun referido se cierra sin motivo (API y base lo exigen).

## Decisiones de cumplimiento

- **No se guarda numero de Medicare (MBI) ni de Medicaid.** No existe ninguna columna para ellos. El paciente es nombre, apellido y telefono.
  El productor pide el numero directamente al paciente; la interfaz lo recuerda en cada pantalla relevante.
- Los schemas zod son `.strict()`: una llave como `mbi`, `medicare_number` o `medicaid` responde 400 `unknown_field_rejected`.
- `contains_mbi()` bloquea un MBI escrito en texto libre (nombres, plan, notas, detalles, JSON), en la app (zod) y en la base (CHECK).
- Los datos del paciente nunca van en la URL (rutas con uuid; busqueda por nombre/telefono con POST). Las respuestas llevan `Cache-Control: no-store`.
- Los avisos al productor solo llevan numero R-, clinica y nombre corto; el email opcional es generico, sin datos del paciente.
- Alcance por rol en un solo lugar (`src/lib/referrals/scope.ts`); un referido ajeno responde 404. Los triggers de la base refuerzan
  quien crea, asigna y cierra, y escriben `referral_events` (append-only). Los referidos no se borran.
- Solo se asigna a productores individuales (dependiente / independiente), nunca a agencias. La asignacion es manual.
- Logs estructurados sin nombres, telefonos ni cuerpos de request.

## Idiomas (es / en)

Diccionarios JSON en `src/i18n/dictionaries/{es,en}.json` (es es la fuente de verdad; `en` debe tener las mismas llaves y placeholders,
lo verifica `npm test`). Orden de seleccion: cookie `lang` -> `users.locale` -> `Accept-Language` -> `es`. El selector ES | EN esta en el
encabezado de cada rol y en `/login`, y llama a `PUT /api/me/locale`. La API devuelve codigos (estado, `error.code`, `kind` + `params`
de los avisos) y la interfaz los traduce; los motivos de cierre vienen del catalogo `close_reasons` (`label_es` / `label_en`).

## Rutas de API del productor y avisos

`POST /api/referrals/{id}/attempts`, `POST /api/referrals/{id}/close`, `GET /api/close-reasons`, `GET /api/notifications`,
`GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/cron/notifications` (Bearer `CRON_SECRET`).

## Estado

Modulos 1 a 6 escritos: andamiaje, autenticacion y middleware, API de referidos, vistas de clinica, maestro y productor, i18n y README.
Ademas: administracion de productores y clinicas desde `/maestro` (alta individual, activar/desactivar, carga
masiva de productores por Excel vía `POST /api/producers/bulk` con plantilla en `GET /api/producers/template`).
`npm run typecheck`, `npm run build` y `npm test` (vitest) pasan.

Pendiente / conocido:

- Email SMTP del aviso: `/api/cron/notifications` solo informa los pendientes; el envio real no esta implementado (sin dependencia de correo).
- Pruebas de integracion contra Postgres y los flujos Playwright en movil no estan escritos.
- Fuera de alcance: asignacion automatica, validacion de contratos, grabacion de llamadas, pagos o incentivos, otras lineas de negocio,
  buscador de planes por medico, RLS (fase 2).
