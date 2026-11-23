import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Progreso } from "../../../models/Progreso";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esIdValido } from "../../../lib/medico";

// GET /api/paciente/progreso
export const GET: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") return json({ error: "No autorizado" }, 403);

    await connectDB();
    const registros = await Progreso.find({ paciente: session.userId })
      .populate("rutina", "nombre")
      .sort({ fecha: -1 })
      .limit(30);

    return json(registros);
  } catch (error) {
    console.error("GET progreso paciente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

const nivelDolor = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
};

// POST /api/paciente/progreso - Registrar una sesión de una de sus rutinas activas
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") return json({ error: "No autorizado" }, 403);

    const body = await request.json().catch(() => ({}));
    if (!esIdValido(body.rutina)) return json({ error: "Rutina inválida" }, 400);

    const dolorAntes = nivelDolor(body.dolorAntes);
    const dolorDespues = nivelDolor(body.dolorDespues);
    if (dolorAntes === null || dolorDespues === null) {
      return json({ error: "El dolor debe ser un número del 0 al 10" }, 400);
    }

    await connectDB();
    const rutina = await Rutina.findOne({ _id: body.rutina, paciente: session.userId }).select("medico activa ejercicios");
    if (!rutina) return json({ error: "Rutina no encontrada" }, 404);
    if (!rutina.activa) return json({ error: "Esta rutina está pausada por tu fisioterapeuta" }, 409);

    const total = rutina.ejercicios.length;
    const hechos = body.ejerciciosCompletados === undefined ? total : Number(body.ejerciciosCompletados);
    if (!Number.isInteger(hechos) || hechos < 0 || hechos > total) {
      return json({ error: "Número de ejercicios completados inválido" }, 400);
    }

    // Solo se aceptan los campos que el paciente puede llenar; el médico sale de la rutina
    const progreso = await Progreso.create({
      paciente: session.userId,
      medico: rutina.medico,
      rutina: rutina._id,
      dolorAntes,
      dolorDespues,
      notasPaciente: String(body.notasPaciente ?? "").trim().slice(0, 1000) || undefined,
      totalEjercicios: total,
      ejerciciosCompletados: hechos,
      completado: hechos === total,
    });

    return json(progreso, 201);
  } catch (error) {
    console.error("POST progreso paciente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
