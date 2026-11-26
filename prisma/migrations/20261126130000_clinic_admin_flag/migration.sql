-- Distingue, dentro del personal de una clinica, quien ve TODOS los referidos de la clinica
-- (administrador de la clinica) de quien solo ve los que el mismo registro (personal individual).
-- Solo aplica a users.role = 'clinica'; en los demas roles la columna no se usa.
ALTER TABLE users ADD COLUMN clinic_admin boolean NOT NULL DEFAULT false;

-- Preserva el comportamiento actual: todo usuario de clinica que ya existia seguia viendo todos
-- los referidos de su clinica, asi que se marcan como administradores al migrar.
UPDATE users SET clinic_admin = true WHERE role = 'clinica';
