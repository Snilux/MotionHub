import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esMiPaciente, esIdValido } from "../../../lib/medico";
import { ejercicioSinArchivo, textoFrecuencia, validarEjercicios, validarFrecuencia } from "../../../lib/rutina";

// GET /api/medico/rutinas
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    await connectDB();
    const pacienteId = url.searchParams.get("paciente");
    const filtro: Record<string, unknown> = { medico: session.userId };
    if (esIdValido(pacienteId)) filtro.paciente = pacienteId;

    const rutinas = await Rutina.find(filtro)
      .populate("paciente", "nombre apellido email")
      .sort({ createdAt: -1 });
    return json(rutinas);
  } catch (error) {
    console.error("GET rutinas medico error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// POST /api/medico/rutinas - Crear rutina
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const body = await request.json();
    await connectDB();

    if (!(await esMiPaciente(session.userId, body.paciente))) {
      return json({ error: "Selecciona uno de tus pacientes" }, 400);
    }

    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) return json({ error: "El nombre de la rutina es requerido" }, 400);

    const frec = validarFrecuencia(body.frecuenciaVeces, body.frecuenciaPeriodo, body.frecuenciaDias);
    if ("error" in frec) return json({ error: frec.error }, 400);

    const validacion = validarEjercicios(body.ejercicios ?? [], session.userId);
    if ("error" in validacion) return json({ error: validacion.error }, 400);
    if (validacion.ejercicios.length === 0) return json({ error: "Agrega al menos un ejercicio" }, 400);
    const sinVideo = await ejercicioSinArchivo(validacion.ejercicios);
    if (sinVideo) return json({ error: `«${sinVideo}»: no se encontró el video, súbelo de nuevo` }, 400);

    const rutina = await Rutina.create({
      nombre,
      objetivo: String(body.objetivo ?? "").trim() || undefined,
      descripcion: String(body.descripcion ?? "").trim() || undefined,
      paciente: body.paciente,
      medico: session.userId,
      frecuenciaVeces: frec.veces,
      frecuenciaPeriodo: frec.periodo,
      frecuenciaDias: frec.dias.length ? frec.dias : undefined,
      frecuencia: textoFrecuencia(frec.veces, frec.periodo, frec.dias),
      ejercicios: validacion.ejercicios,
    });

    return json(await rutina.populate("paciente", "nombre apellido email"), 201);
  } catch (error) {
    console.error("POST rutinas medico error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
