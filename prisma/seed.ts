// Seed minimo para desarrollo y staging. No corre con NODE_ENV=production.
// Las contrasenas salen de SEED_DEFAULT_PASSWORD (.env local); no se imprimen.
// Los ~20 referidos de ejemplo pasan por el servicio real (src/lib/referrals/service.ts),
// que a su vez pasa por withActor y los triggers de la base (set_config('app.actor_user_id', ...)),
// para que la auditoria y las reglas de negocio queden identicas a las de la app.
import "dotenv/config";
import { ProducerType, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password";
import { createReferral, assignReferral, registerAttempt, closeReferral } from "../src/lib/referrals/service";
import type { AuthSession } from "../src/lib/auth/guard";

const CLINICS = [
  { name: "Clinica Demo Norte", userEmail: "norte@clinica-demo.example", userName: "Recepcion Norte" },
  { name: "Clinica Demo Centro", userEmail: "centro@clinica-demo.example", userName: "Recepcion Centro" },
  { name: "Clinica Demo Sur", userEmail: "sur@clinica-demo.example", userName: "Recepcion Sur" },
];

const PRODUCERS: { fullName: string; type: ProducerType; npn: string; phone: string; email: string }[] = [
  { fullName: "Productor Dependiente Uno", type: "dependiente", npn: "1000001", phone: "+13055550101", email: "productor1@claro-demo.example" },
  { fullName: "Productor Dependiente Dos", type: "dependiente", npn: "1000002", phone: "+13055550102", email: "productor2@claro-demo.example" },
  { fullName: "Productor Independiente Uno", type: "independiente", npn: "1000003", phone: "+13055550103", email: "productor3@claro-demo.example" },
  { fullName: "Productor Independiente Dos", type: "independiente", npn: "1000004", phone: "+13055550104", email: "productor4@claro-demo.example" },
];

const MASTER_EMAIL = "dave@claro-demo.example";

// Plan de ~20 referidos de ejemplo, repartidos entre las 3 clinicas y los 4 productores,
// cubriendo todos los estados del flujo. Indices: clinic -> CLINICS, producer -> PRODUCERS.
// Ningun campo aqui es un dato real de paciente ni incluye MBI/Medicaid.
const SAMPLE_REFERRALS: {
  clinic: number;
  first: string;
  last: string;
  phone: string;
  producer?: number;
  attempt?: "contactado" | "sin_contacto";
  close?:
    | { outcome: "inscrito"; plan_name: string; enrollment_date: string; effective_date: string }
    | { outcome: "no_inscrito"; reason_code: string; reason_detail?: string };
}[] = [
  // Nuevo (sin asignar) - bandeja del maestro
  { clinic: 0, first: "Maria", last: "Gonzalez", phone: "+13055552001" },
  { clinic: 0, first: "Carlos", last: "Diaz", phone: "+13055552002" },
  { clinic: 1, first: "Ana", last: "Martinez", phone: "+13055552003" },
  { clinic: 1, first: "Luis", last: "Fernandez", phone: "+13055552004" },
  { clinic: 2, first: "Rosa", last: "Lopez", phone: "+13055552005" },
  { clinic: 2, first: "Jose", last: "Ramirez", phone: "+13055552006" },
  // Asignado (sin trabajar aun)
  { clinic: 0, first: "Elena", last: "Suarez", phone: "+13055552007", producer: 0 },
  { clinic: 1, first: "Pedro", last: "Castro", phone: "+13055552008", producer: 1 },
  { clinic: 2, first: "Isabel", last: "Mora", phone: "+13055552009", producer: 2 },
  { clinic: 0, first: "Francisco", last: "Nunez", phone: "+13055552010", producer: 3 },
  // Contactado / Sin contacto
  { clinic: 1, first: "Teresa", last: "Rojas", phone: "+13055552011", producer: 0, attempt: "contactado" },
  { clinic: 2, first: "Ricardo", last: "Paredes", phone: "+13055552012", producer: 1, attempt: "contactado" },
  { clinic: 0, first: "Patricia", last: "Vega", phone: "+13055552013", producer: 2, attempt: "sin_contacto" },
  { clinic: 1, first: "Miguel", last: "Santos", phone: "+13055552014", producer: 3, attempt: "sin_contacto" },
  // Inscrito (estado final, con plan y fechas)
  {
    clinic: 2, first: "Gloria", last: "Campos", phone: "+13055552015", producer: 0, attempt: "contactado",
    close: { outcome: "inscrito", plan_name: "Humana Gold Plus HMO", enrollment_date: "2026-11-10", effective_date: "2026-12-01" },
  },
  {
    clinic: 0, first: "Ernesto", last: "Guerrero", phone: "+13055552016", producer: 1, attempt: "contactado",
    close: { outcome: "inscrito", plan_name: "Aetna Medicare Choice PPO", enrollment_date: "2026-11-05", effective_date: "2026-12-01" },
  },
  {
    clinic: 1, first: "Beatriz", last: "Reyes", phone: "+13055552017", producer: 2, attempt: "contactado",
    close: { outcome: "inscrito", plan_name: "WellCare Medicare Select", enrollment_date: "2026-11-18", effective_date: "2027-01-01" },
  },
  {
    clinic: 2, first: "Alberto", last: "Ortiz", phone: "+13055552018", producer: 3, attempt: "contactado",
    close: { outcome: "inscrito", plan_name: "Devoted Health Complete", enrollment_date: "2026-11-20", effective_date: "2027-01-01" },
  },
  // No inscrito (estado final, con motivo obligatorio)
  { clinic: 0, first: "Silvia", last: "Cordero", phone: "+13055552019", producer: 0, close: { outcome: "no_inscrito", reason_code: "no_contesto" } },
  { clinic: 1, first: "Hector", last: "Molina", phone: "+13055552020", producer: 1, close: { outcome: "no_inscrito", reason_code: "numero_equivocado" } },
  { clinic: 2, first: "Veronica", last: "Salas", phone: "+13055552021", producer: 2, close: { outcome: "no_inscrito", reason_code: "no_califica" } },
  {
    clinic: 0, first: "Manuel", last: "Prado", phone: "+13055552022", producer: 3,
    close: { outcome: "no_inscrito", reason_code: "otro", reason_detail: "Paciente ya tenia agente asignado por otra via" },
  },
];

function fakeSession(opts: {
  userId: string;
  role: AuthSession["role"];
  clinicId?: string | null;
  producerId?: string | null;
  fullName: string;
  email: string;
}): AuthSession {
  return {
    sessionId: "seed",
    userId: opts.userId,
    role: opts.role,
    clinicId: opts.clinicId ?? null,
    producerId: opts.producerId ?? null,
    fullName: opts.fullName,
    email: opts.email,
    locale: "es",
    mustChangePassword: false,
  };
}

async function currentVersion(id: string): Promise<number> {
  const row = await prisma.referral.findUniqueOrThrow({ where: { id }, select: { version: true } });
  return row.version;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed no corre con NODE_ENV=production.");
  }
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Define SEED_DEFAULT_PASSWORD en .env (minimo ${MIN_PASSWORD_LENGTH} caracteres).`);
  }
  const passwordHash = await hashPassword(password);

  // Maestro (Dave)
  const masterUser = await prisma.user.upsert({
    where: { email: MASTER_EMAIL },
    update: {},
    create: {
      email: MASTER_EMAIL,
      fullName: "Dave (Maestro)",
      role: UserRole.maestro,
      passwordHash,
      mustChangePassword: true,
    },
  });
  const masterSession = fakeSession({ userId: masterUser.id, role: "maestro", fullName: masterUser.fullName, email: masterUser.email });

  // Clinicas + 1 usuario cada una (el nombre es unico por lower(name) en la migracion)
  const clinicRecords: { clinicId: string; session: AuthSession }[] = [];
  for (const c of CLINICS) {
    let clinic = await prisma.clinic.findFirst({ where: { name: { equals: c.name, mode: "insensitive" } } });
    if (!clinic) clinic = await prisma.clinic.create({ data: { name: c.name } });
    const user = await prisma.user.upsert({
      where: { email: c.userEmail },
      update: {},
      create: {
        email: c.userEmail,
        fullName: c.userName,
        role: UserRole.clinica,
        clinicId: clinic.id,
        passwordHash,
        mustChangePassword: true,
      },
    });
    clinicRecords.push({
      clinicId: clinic.id,
      session: fakeSession({ userId: user.id, role: "clinica", clinicId: clinic.id, fullName: user.fullName, email: user.email }),
    });
  }

  // Productores individuales (2 dependientes, 2 independientes) + usuario de acceso
  const producerRecords: { producerId: string; session: AuthSession }[] = [];
  for (const p of PRODUCERS) {
    const producer = await prisma.producer.upsert({
      where: { npn: p.npn },
      update: {},
      create: { fullName: p.fullName, producerType: p.type, npn: p.npn, phone: p.phone },
    });
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        fullName: p.fullName,
        role: UserRole.productor,
        producerId: producer.id,
        passwordHash,
        mustChangePassword: true,
      },
    });
    producerRecords.push({
      producerId: producer.id,
      session: fakeSession({ userId: user.id, role: "productor", producerId: producer.id, fullName: user.fullName, email: user.email }),
    });
  }

  console.log(
    `Seed base listo: 1 maestro, ${CLINICS.length} clinicas, ${PRODUCERS.length} productores (con usuarios).`,
  );

  // Referidos de ejemplo: solo si la tabla esta vacia, para que correr el seed varias veces no duplique.
  const existingReferrals = await prisma.referral.count();
  if (existingReferrals > 0) {
    console.log(`Referidos de ejemplo omitidos: ya existen ${existingReferrals} en la base.`);
  } else {
    for (const item of SAMPLE_REFERRALS) {
      const clinicSession = clinicRecords[item.clinic]!.session;
      const created = await createReferral(clinicSession, { first_name: item.first, last_name: item.last, phone: item.phone });

      if (item.producer === undefined) continue;
      const producer = producerRecords[item.producer]!;
      await assignReferral(masterSession, created.id, producer.producerId);

      if (item.attempt) {
        const version = await currentVersion(created.id);
        await registerAttempt(producer.session, created.id, { outcome: item.attempt, expected_version: version });
      }

      if (item.close) {
        const version = await currentVersion(created.id);
        await closeReferral(producer.session, created.id, { ...item.close, expected_version: version });
      }
    }
    console.log(`Referidos de ejemplo creados: ${SAMPLE_REFERRALS.length}.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
