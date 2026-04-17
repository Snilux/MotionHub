/**
 * Script de seed para poblar la base de datos con datos de prueba
 * Ejecutar con: node src/scripts/seed.js
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/motionhub";

// ── Schemas inline (para no depender de TS en el seed) ──────────────────────
const UserSchema = new mongoose.Schema({
  nombre: String, apellido: String, email: { type: String, unique: true },
  password: String, role: String, telefono: String,
  cedulaProfesional: String, especialidad: String,
  medicoAsignado: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  diagnostico: String,
}, { timestamps: true });

const CitaSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medico:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fecha: Date, duracion: Number, tipo: String, estado: String, notas: String,
}, { timestamps: true });

const RutinaSchema = new mongoose.Schema({
  nombre: String, descripcion: String,
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medico:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ejercicios: [{ nombre: String, descripcion: String, series: Number,
    repeticiones: Number, descanso: Number, notas: String }],
  frecuencia: String, objetivo: String, activa: Boolean,
  fechaInicio: Date,
}, { timestamps: true });

const ExpedienteSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  medico:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  diagnostico: String, motivoConsulta: String,
  antecedentes: String, alergias: String, medicamentos: String,
  altura: Number, peso: Number,
  evolucion: [{ fecha: Date, nota: String, medico: mongoose.Schema.Types.ObjectId }],
}, { timestamps: true });

const ProgresoSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medico:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rutina:   { type: mongoose.Schema.Types.ObjectId, ref: "Rutina" },
  fecha: Date, dolorAntes: Number, dolorDespues: Number,
  notasPaciente: String, completado: Boolean,
  ejerciciosCompletados: Number, totalEjercicios: Number,
}, { timestamps: true });

const User      = mongoose.model("User",      UserSchema);
const Cita      = mongoose.model("Cita",      CitaSchema);
const Rutina    = mongoose.model("Rutina",    RutinaSchema);
const Expediente= mongoose.model("Expediente",ExpedienteSchema);
const Progreso  = mongoose.model("Progreso",  ProgresoSchema);

// ── Helpers ──────────────────────────────────────────────────────────────────
const hash = (pw) => bcrypt.hash(pw, 12);

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Conectado a MongoDB:", MONGODB_URI);

  // Limpiar colecciones
  await Promise.all([
    User.deleteMany({}), Cita.deleteMany({}),
    Rutina.deleteMany({}), Expediente.deleteMany({}), Progreso.deleteMany({}),
  ]);
  console.log("🗑️  Colecciones limpiadas");

  // ── Médicos ──────────────────────────────────────────────────────────────
  const medico1 = await User.create({
    nombre: "Carlos", apellido: "Ramírez",
    email: "medico@motionhub.com",
    password: await hash("medico123"),
    role: "medico",
    telefono: "222-100-0001",
    cedulaProfesional: "FT-2019-001",
    especialidad: "Fisioterapia deportiva",
  });

  const medico2 = await User.create({
    nombre: "Ana", apellido: "Torres",
    email: "ana@motionhub.com",
    password: await hash("medico123"),
    role: "medico",
    telefono: "222-100-0002",
    cedulaProfesional: "FT-2021-042",
    especialidad: "Rehabilitación neurológica",
  });

  // ── Pacientes ────────────────────────────────────────────────────────────
  const paciente1 = await User.create({
    nombre: "Juan", apellido: "López",
    email: "paciente@motionhub.com",
    password: await hash("paciente123"),
    role: "paciente",
    telefono: "222-200-0001",
    medicoAsignado: medico1._id,
    diagnostico: "Lesión de ligamento cruzado anterior (LCA) rodilla derecha",
  });

  const paciente2 = await User.create({
    nombre: "María", apellido: "González",
    email: "maria@motionhub.com",
    password: await hash("paciente123"),
    role: "paciente",
    telefono: "222-200-0002",
    medicoAsignado: medico1._id,
    diagnostico: "Lumbalgia crónica inespecífica",
  });

  const paciente3 = await User.create({
    nombre: "Pedro", apellido: "Hernández",
    email: "pedro@motionhub.com",
    password: await hash("paciente123"),
    role: "paciente",
    telefono: "222-200-0003",
    medicoAsignado: medico2._id,
    diagnostico: "Hemiplegia post-ACV",
  });

  console.log("👥 Usuarios creados");

  // ── Citas ────────────────────────────────────────────────────────────────
  await Cita.insertMany([
    { paciente: paciente1._id, medico: medico1._id, fecha: daysFromNow(2),
      duracion: 60, tipo: "tratamiento", estado: "confirmada",
      notas: "Traer ropa cómoda y zapatos deportivos" },
    { paciente: paciente1._id, medico: medico1._id, fecha: daysFromNow(7),
      duracion: 60, tipo: "seguimiento", estado: "pendiente" },
    { paciente: paciente2._id, medico: medico1._id, fecha: daysFromNow(1),
      duracion: 45, tipo: "tratamiento", estado: "confirmada" },
    { paciente: paciente2._id, medico: medico1._id, fecha: daysAgo(14),
      duracion: 60, tipo: "evaluacion", estado: "completada" },
    { paciente: paciente3._id, medico: medico2._id, fecha: daysFromNow(3),
      duracion: 90, tipo: "tratamiento", estado: "pendiente" },
    { paciente: paciente1._id, medico: medico1._id, fecha: daysAgo(7),
      duracion: 60, tipo: "tratamiento", estado: "completada" },
  ]);

  console.log("📅 Citas creadas");

  // ── Rutinas ──────────────────────────────────────────────────────────────
  const rutina1 = await Rutina.create({
    nombre: "Rehabilitación LCA – Fase 1",
    descripcion: "Ejercicios de fortalecimiento inicial post-cirugía",
    paciente: paciente1._id, medico: medico1._id,
    objetivo: "Recuperar rango de movimiento y reducir inflamación",
    frecuencia: "5 veces por semana",
    activa: true, fechaInicio: daysAgo(14),
    ejercicios: [
      { nombre: "Contracción cuádriceps en extensión", descripcion: "Acostado boca arriba, contraer el cuádriceps sin mover la pierna. Mantener 5 segundos.", series: 3, repeticiones: 15, descanso: 30 },
      { nombre: "Elevación de pierna recta", descripcion: "Elevar la pierna a 45° sin doblar la rodilla. Bajar lentamente.", series: 3, repeticiones: 10, descanso: 45 },
      { nombre: "Flexión pasiva de rodilla", descripcion: "Con ayuda de una toalla, doblar la rodilla suavemente hasta el límite del dolor.", series: 2, repeticiones: 10, descanso: 60 },
      { nombre: "Hielo en rodilla", descripcion: "Aplicar bolsa de hielo envuelta en toalla. No aplicar directo sobre la piel.", series: 1, repeticiones: 1, descanso: 0, notas: "20 minutos, 3 veces al día" },
    ],
  });

  const rutina2 = await Rutina.create({
    nombre: "Fortalecimiento Lumbar",
    descripcion: "Rutina para lumbalgia crónica",
    paciente: paciente2._id, medico: medico1._id,
    objetivo: "Fortalecer musculatura paravertebral y reducir dolor",
    frecuencia: "3 veces por semana",
    activa: true, fechaInicio: daysAgo(21),
    ejercicios: [
      { nombre: "Puente de glúteos", descripcion: "Acostado boca arriba, pies en el suelo. Elevar cadera hasta alinear con rodillas y hombros.", series: 3, repeticiones: 12, descanso: 45 },
      { nombre: "Bird-dog", descripcion: "En cuatro puntos, extender brazo y pierna contrarios manteniendo espalda recta.", series: 3, repeticiones: 10, descanso: 30 },
      { nombre: "Plancha abdominal", descripcion: "Mantener posición de plancha apoyado en antebrazos.", series: 3, repeticiones: 1, descanso: 60, notas: "Mantener 20-30 segundos cada repetición" },
      { nombre: "Estiramiento de flexores de cadera", descripcion: "En posición de caballero, inclinar el cuerpo hacia adelante suavemente.", series: 2, repeticiones: 1, descanso: 30, notas: "Mantener 30 segundos cada lado" },
    ],
  });

  console.log("🏋️  Rutinas creadas");

  // ── Expedientes ──────────────────────────────────────────────────────────
  await Expediente.create({
    paciente: paciente1._id, medico: medico1._id,
    diagnostico: "Ruptura parcial LCA rodilla derecha post-intervención quirúrgica",
    motivoConsulta: "Rehabilitación post-quirúrgica, referido por Dr. Martínez (traumatología)",
    antecedentes: "Cirugía LCA 15/03/2024. Sin otras cirugías previas. Practica fútbol amateur.",
    alergias: "Ninguna conocida",
    medicamentos: "Ibuprofeno 400mg c/8h (por prescripción médica), Complejo B",
    altura: 178, peso: 75,
    evolucion: [
      { fecha: daysAgo(14), nota: "Primera sesión. Rango de movimiento: 0-45°. Inflamación moderada. Inicia protocolo fase 1.", medico: medico1._id },
      { fecha: daysAgo(7),  nota: "Segunda semana. ROM mejoró a 0-75°. Inflamación disminuida. Tolera bien los ejercicios.", medico: medico1._id },
      { fecha: daysAgo(2),  nota: "Tercera semana. ROM 0-90°. Sin dolor en reposo. Avanzar a fase 2 la próxima semana.", medico: medico1._id },
    ],
  });

  await Expediente.create({
    paciente: paciente2._id, medico: medico1._id,
    diagnostico: "Lumbalgia crónica inespecífica L4-L5",
    motivoConsulta: "Dolor lumbar de 6 meses de evolución. Agravado con actividad física.",
    antecedentes: "Trabajo de oficina 8h/día. Sedentarismo. Sin cirugías previas.",
    alergias: "Penicilina",
    medicamentos: "Naproxeno 500mg PRN",
    altura: 162, peso: 68,
    evolucion: [
      { fecha: daysAgo(21), nota: "Evaluación inicial. EVA 7/10. Flexión lumbar limitada. Inicio de programa de ejercicio terapéutico.", medico: medico1._id },
      { fecha: daysAgo(10), nota: "Segunda evaluación. EVA 4/10. Mejora notable en movilidad. Continuar con programa actual.", medico: medico1._id },
    ],
  });

  console.log("📋 Expedientes creados");

  // ── Progreso ─────────────────────────────────────────────────────────────
  const progresoData = [];
  for (let i = 12; i >= 0; i--) {
    if (i % 2 === 0) { // ~3 veces por semana
      progresoData.push({
        paciente: paciente1._id, medico: medico1._id, rutina: rutina1._id,
        fecha: daysAgo(i),
        dolorAntes:   Math.max(0, 7 - Math.floor(i / 2)),
        dolorDespues: Math.max(0, 5 - Math.floor(i / 2)),
        notasPaciente: i === 0 ? "Me siento mucho mejor hoy!" : i === 6 ? "Un poco de tensión al inicio" : "",
        completado: true, totalEjercicios: 4, ejerciciosCompletados: 4,
      });
    }
  }

  for (let i = 20; i >= 0; i -= 3) {
    progresoData.push({
      paciente: paciente2._id, medico: medico1._id, rutina: rutina2._id,
      fecha: daysAgo(i),
      dolorAntes:   Math.max(0, 7 - Math.floor(i / 4)),
      dolorDespues: Math.max(0, 4 - Math.floor(i / 5)),
      completado: true, totalEjercicios: 4, ejerciciosCompletados: 4,
    });
  }

  await Progreso.insertMany(progresoData);
  console.log("📊 Registros de progreso creados");

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log("\n🎉 Seed completado exitosamente!\n");
  console.log("════════════════════════════════════════");
  console.log("  CREDENCIALES DE ACCESO");
  console.log("════════════════════════════════════════");
  console.log("  MÉDICO 1 (Fisioterapia deportiva)");
  console.log("  📧 medico@motionhub.com");
  console.log("  🔑 medico123\n");
  console.log("  MÉDICO 2 (Rehabilitación neurológica)");
  console.log("  📧 ana@motionhub.com");
  console.log("  🔑 medico123\n");
  console.log("  PACIENTE 1 (LCA rodilla)");
  console.log("  📧 paciente@motionhub.com");
  console.log("  🔑 paciente123\n");
  console.log("  PACIENTE 2 (Lumbalgia)");
  console.log("  📧 maria@motionhub.com");
  console.log("  🔑 paciente123");
  console.log("════════════════════════════════════════\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
