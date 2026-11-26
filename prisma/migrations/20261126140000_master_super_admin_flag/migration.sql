-- Distingue, dentro del rol maestro, quien puede crear y administrar otras cuentas de maestro
-- (administrador maestro) de un maestro normal. Solo aplica a users.role = 'maestro'.
ALTER TABLE users ADD COLUMN super_admin boolean NOT NULL DEFAULT false;

-- product@claroinsurance.com queda como el primer administrador maestro (no-op si no existe,
-- por ejemplo en una base local recien sembrada).
UPDATE users SET super_admin = true WHERE role = 'maestro' AND email = 'product@claroinsurance.com';
