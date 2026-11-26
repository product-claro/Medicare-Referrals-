import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { hashPassword } from "./auth/password";
import { generateTempPassword } from "./auth/temp-password";
import { OPEN_STATUSES } from "./referrals/transitions";

// Productores y clinicas (selectores y altas del maestro). Todo queda en audit_log.

type ActiveFilter = "true" | "false" | "all";
const activeWhere = (f: ActiveFilter) => (f === "all" ? {} : { active: f === "true" });

function producerView(p: {
  id: string;
  fullName: string;
  producerType: string;
  npn: string | null;
  phone: string | null;
  active: boolean;
  user?: { id: string; email: string; active: boolean } | null;
}, openLoad?: number) {
  return {
    id: p.id,
    full_name: p.fullName,
    producer_type: p.producerType,
    npn: p.npn,
    phone: p.phone,
    active: p.active,
    ...(openLoad !== undefined ? { open_load: openLoad } : {}),
    ...(p.user !== undefined ? { user: p.user && { id: p.user.id, email: p.user.email, active: p.user.active } } : {}),
  };
}

// Por defecto solo activos, con la carga abierta (asignado + contactado + sin_contacto) para la bandeja.
export async function listProducers(active: ActiveFilter) {
  const [producers, load] = await Promise.all([
    prisma.producer.findMany({
      where: activeWhere(active),
      include: { user: { select: { id: true, email: true, active: true } } },
    }),
    prisma.referral.groupBy({
      by: ["producerId"],
      where: { status: { in: [...OPEN_STATUSES] }, producerId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const loadById = new Map(load.map((l) => [l.producerId, l._count._all]));
  const items = producers
    .map((p) => ({ open_load: loadById.get(p.id) ?? 0, view: producerView(p, loadById.get(p.id) ?? 0) }))
    .sort((a, b) => a.open_load - b.open_load || a.view.full_name.localeCompare(b.view.full_name))
    .map((x) => x.view);
  return { items };
}

export async function createProducer(
  actorUserId: string,
  input: { full_name: string; producer_type: "dependiente" | "independiente"; npn?: string; phone?: string; email?: string },
) {
  const tempPassword = input.email ? generateTempPassword() : null;
  const passwordHash = tempPassword ? await hashPassword(tempPassword) : null;
  const result = await prisma.$transaction(async (tx) => {
    const p = await tx.producer.create({
      data: {
        fullName: input.full_name,
        producerType: input.producer_type,
        npn: input.npn ?? null,
        phone: input.phone ?? null,
        ...(input.email && passwordHash
          ? {
              user: {
                create: {
                  email: input.email,
                  fullName: input.full_name,
                  role: "productor",
                  passwordHash,
                  mustChangePassword: true,
                },
              },
            }
          : {}),
      },
      include: { user: { select: { id: true, email: true, active: true } } },
    });
    await tx.auditLog.create({
      data: { actorUserId, action: "producer.created", entityType: "producer", entityId: p.id },
    });
    if (p.user) {
      await tx.auditLog.create({
        data: { actorUserId, action: "user.created", entityType: "user", entityId: p.user.id, data: { role: "productor" } },
      });
    }
    return p;
  });
  return {
    ...producerView(result),
    ...(tempPassword && result.user ? { temp_password: tempPassword } : {}), // se muestra una sola vez
  };
}

export async function updateProducer(
  actorUserId: string,
  id: string,
  input: {
    full_name?: string;
    producer_type?: "dependiente" | "independiente";
    npn?: string | null;
    phone?: string | null;
    active?: boolean;
  },
) {
  const data: Prisma.ProducerUpdateInput = {
    ...(input.full_name !== undefined ? { fullName: input.full_name } : {}),
    ...(input.producer_type !== undefined ? { producerType: input.producer_type } : {}),
    ...(input.npn !== undefined ? { npn: input.npn } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.producer.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new ApiError(404, "not_found");
    const p = await tx.producer.update({
      where: { id },
      data,
      include: { user: { select: { id: true, email: true, active: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: input.active === false ? "producer.deactivated" : "producer.updated",
        entityType: "producer",
        entityId: id,
        data: { fields: Object.keys(input) },
      },
    });
    return p;
  });
  return producerView(updated);
}

// ---------------------------------------------------------------- clinicas
function clinicView(c: { id: string; name: string; active: boolean; _count?: { users: number; referrals: number } }) {
  return {
    id: c.id,
    name: c.name,
    active: c.active,
    ...(c._count ? { users_count: c._count.users, referrals_count: c._count.referrals } : {}),
  };
}

export async function listClinics(active: ActiveFilter) {
  const clinics = await prisma.clinic.findMany({
    where: activeWhere(active),
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, referrals: true } } },
  });
  return { items: clinics.map(clinicView) };
}

export async function createClinic(actorUserId: string, input: { name: string; email: string; full_name: string }) {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const clinic = await prisma.$transaction(async (tx) => {
    const c = await tx.clinic.create({
      data: {
        name: input.name,
        users: {
          create: {
            email: input.email,
            fullName: input.full_name,
            role: "clinica",
            // El usuario que se crea junto con la clinica es su administrador: ve todos sus referidos.
            clinicAdmin: true,
            passwordHash,
            mustChangePassword: true,
          },
        },
      },
      include: { users: { select: { id: true, email: true } } },
    });
    await tx.auditLog.create({ data: { actorUserId, action: "clinic.created", entityType: "clinic", entityId: c.id } });
    const u = c.users[0];
    if (u) {
      await tx.auditLog.create({
        data: { actorUserId, action: "user.created", entityType: "user", entityId: u.id, data: { role: "clinica" } },
      });
    }
    return c;
  });
  const u = clinic.users[0];
  return { ...clinicView(clinic), user: u && { id: u.id, email: u.email, temp_password: tempPassword } };
}

export async function getClinic(id: string) {
  const clinic = await prisma.clinic.findUnique({
    where: { id },
    include: { _count: { select: { users: true, referrals: true } } },
  });
  if (!clinic) throw new ApiError(404, "not_found");
  return clinicView(clinic);
}

function clinicUserView(u: {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  clinicAdmin: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    active: u.active,
    clinic_admin: u.clinicAdmin,
    must_change_password: u.mustChangePassword,
    last_login_at: u.lastLoginAt,
  };
}

// Personal de una clinica: varias personas pueden tener su propio login, todas ven los mismos
// referidos de la clinica (el alcance es por clinic_id, no por usuario individual).
export async function listClinicUsers(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
  if (!clinic) throw new ApiError(404, "not_found");
  const users = await prisma.user.findMany({
    where: { clinicId, role: "clinica" },
    orderBy: { createdAt: "asc" },
  });
  return { items: users.map(clinicUserView) };
}

export async function createClinicUser(
  actorUserId: string,
  clinicId: string,
  input: { full_name: string; email: string; clinic_admin?: boolean },
) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
  if (!clinic) throw new ApiError(404, "not_found");
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const clinicAdmin = input.clinic_admin ?? false;
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: input.email,
        fullName: input.full_name,
        role: "clinica",
        clinicId,
        clinicAdmin,
        passwordHash,
        mustChangePassword: true,
      },
    });
    await tx.auditLog.create({
      data: { actorUserId, action: "user.created", entityType: "user", entityId: u.id, data: { role: "clinica", clinic_id: clinicId, clinic_admin: clinicAdmin } },
    });
    return u;
  });
  return { ...clinicUserView(user), temp_password: tempPassword };
}

// Generico: activa o desactiva cualquier usuario (lo usa hoy la pantalla de personal de clinica).
export async function setUserActive(actorUserId: string, userId: string, active: boolean) {
  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new ApiError(404, "not_found");
    const u = await tx.user.update({ where: { id: userId }, data: { active } });
    await tx.auditLog.create({
      data: { actorUserId, action: active ? "user.activated" : "user.deactivated", entityType: "user", entityId: userId },
    });
    return u;
  });
  return clinicUserView(updated);
}

// Promueve o quita el "administrador de clinica" (ve todos los referidos vs. solo los propios).
export async function setClinicUserAdmin(actorUserId: string, userId: string, clinicAdmin: boolean) {
  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!exists || exists.role !== "clinica") throw new ApiError(404, "not_found");
    const u = await tx.user.update({ where: { id: userId }, data: { clinicAdmin } });
    await tx.auditLog.create({
      data: { actorUserId, action: "user.updated", entityType: "user", entityId: userId, data: { clinic_admin: clinicAdmin } },
    });
    return u;
  });
  return clinicUserView(updated);
}

export async function updateClinic(actorUserId: string, id: string, input: { name?: string; active?: boolean }) {
  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.clinic.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new ApiError(404, "not_found");
    const c = await tx.clinic.update({ where: { id }, data: input });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: input.active === false ? "clinic.deactivated" : "clinic.updated",
        entityType: "clinic",
        entityId: id,
        data: { fields: Object.keys(input) },
      },
    });
    return c;
  });
  return clinicView(updated);
}
