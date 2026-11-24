import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Progreso } from "../../../models/Progreso";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esIdValido } from "../../../lib/medico";
import { desdeParaEvaluar, estadoRegistro } from "../../../lib/frecuencia";
import { NOTA_VOZ_MAX_BYTES, NOTA_VOZ_MAX_SEG, borrarArchivo, guardarArchivo, tipoAudio, type ExtAudio } from "../../../lib/storage";
import { CARPETA_NOTAS_VOZ } from "../../../lib/notaVoz";

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

    // JSON, o multipart cuando trae una nota de voz (campo "notaVoz")
    let body: Record<string, any> = {};
    let audio: File | null = null;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const largo = Number(request.headers.get("content-length") || 0);
      if (largo > NOTA_VOZ_MAX_BYTES + 64 * 1024) return json({ error: "La nota de voz es demasiado larga" }, 413);
      let fd: FormData;
      try {
        fd = await request.formData();
      } catch {
        return json({ error: "Formato de envío no válido" }, 400);
      }
      for (const [k, v] of fd.entries()) if (typeof v === "string") body[k] = v;
      const a = fd.get("notaVoz");
      if (a && typeof a !== "string" && a.size > 0) audio = a;
    } else {
      body = await request.json().catch(() => ({}));
    }
    if (!esIdValido(body.rutina)) return json({ error: "Rutina inválida" }, 400);

    // Nota de voz: se valida antes de tocar la base de datos
    let audioDatos: Uint8Array | null = null;
    let audioExt: ExtAudio | null = null;
    if (audio) {
      if (audio.size > NOTA_VOZ_MAX_BYTES) return json({ error: "La nota de voz es demasiado larga" }, 413);
      audioDatos = new Uint8Array(await audio.arrayBuffer());
      audioExt = tipoAudio(audioDatos);
      if (!audioExt) return json({ error: "No se reconoció el formato de la nota de voz" }, 415);
    }
    const duracion = Math.round(Number(body.notaVozDuracion));
    const notaVozDuracion = Number.isFinite(duracion) && duracion > 0 ? Math.min(duracion, NOTA_VOZ_MAX_SEG) : undefined;

    const dolorAntes = nivelDolor(body.dolorAntes);
    const dolorDespues = nivelDolor(body.dolorDespues);
    if (dolorAntes === null || dolorDespues === null) {
      return json({ error: "El dolor debe ser un número del 0 al 10" }, 400);
    }

    await connectDB();
    const rutina = await Rutina.findOne({ _id: body.rutina, paciente: session.userId }).select("medico activa ejercicios frecuenciaVeces frecuenciaPeriodo frecuenciaDias");
    if (!rutina) return json({ error: "Rutina no encontrada" }, 404);
    if (!rutina.activa) return json({ error: "Esta rutina está pausada por tu fisioterapeuta" }, 409);

    // Reglas de la frecuencia (lib/frecuencia.ts): días elegidos por el médico, máximo
    // de sesiones del periodo y una sola por ventana (hora / día / semana). Se evalúa
    // con las sesiones guardadas; el índice único rutina+ventana cubre dos envíos a la vez.
    const ahora = new Date();
    const previas = await Progreso.find({ rutina: rutina._id, fecha: { $gte: desdeParaEvaluar(rutina, ahora) } }).select("fecha").lean();
    const estado = estadoRegistro(rutina, previas.map((p) => p.fecha), ahora);
    const ventana = estado.ventana;
    if (!estado.puede) {
      return json({ error: estado.mensaje, titulo: estado.titulo, codigo: estado.codigo }, 409);
    }
    const yaRegistrada = `Ya registraste esta rutina ${ventana.ya}.`;

    const total = rutina.ejercicios.length;
    const hechos = body.ejerciciosCompletados === undefined ? total : Number(body.ejerciciosCompletados);
    if (!Number.isInteger(hechos) || hechos < 0 || hechos > total) {
      return json({ error: "Número de ejercicios completados inválido" }, 400);
    }

    const notaVoz = audioDatos && audioExt
      ? await guardarArchivo(CARPETA_NOTAS_VOZ, session.userId, audioExt, audioDatos)
      : undefined;

    // Solo se aceptan los campos que el paciente puede llenar; el médico sale de la rutina
    try {
      const progreso = await Progreso.create({
        paciente: session.userId,
        medico: rutina.medico,
        rutina: rutina._id,
        dolorAntes,
        dolorDespues,
        notasPaciente: String(body.notasPaciente ?? "").trim().slice(0, 1000) || undefined,
        notaVoz,
        notaVozDuracion: notaVoz ? notaVozDuracion : undefined,
        totalEjercicios: total,
        ejerciciosCompletados: hechos,
        completado: hechos === total,
        ventana: ventana.clave,
      });
      // Cómo queda la rutina tras esta sesión (para la alerta del paciente)
      const despues = estadoRegistro(rutina, [...previas.map((p) => p.fecha), progreso.fecha], new Date());
      return json({ ...progreso.toJSON(), estado: { progreso: despues.progreso, cuandoProx: despues.cuandoProx, completa: despues.hechas >= despues.veces } }, 201);
    } catch (error) {
      await borrarArchivo(notaVoz); // no dejar el audio huérfano si falla la DB
      if ((error as { code?: number })?.code === 11000) return json({ error: yaRegistrada, titulo: "Esta rutina ya está registrada", codigo: "YA_EN_VENTANA" }, 409);
      throw error;
    }
  } catch (error) {
    console.error("POST progreso paciente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
