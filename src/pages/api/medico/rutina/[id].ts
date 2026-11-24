import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { Rutina } from "../../../../models/Rutina";
import { getSessionFromRequest, json } from "../../../../lib/session";
import { esIdValido } from "../../../../lib/medico";
import { ejercicioSinArchivo, textoFrecuencia, validarEjercicios, validarFrecuencia, videosDe } from "../../../../lib/rutina";
import { borrarArchivos } from "../../../../lib/storage";

export const GET: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Rutina inválida" }, 400);

    await connectDB();
    const rutina = await Rutina.findOne({ _id: params.id, medico: session.userId })
      .populate("paciente", "nombre apellido email");
    if (!rutina) return json({ error: "Rutina no encontrada" }, 404);
    return json(rutina);
  } catch (error) {
    console.error("GET rutina error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// PUT - Actualiza solo los campos permitidos (activar/pausar, nombre, frecuencia, ejercicios...)
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Rutina inválida" }, 400);

    const body = await request.json();
    const $set: Record<string, unknown> = {};

    if (typeof body.activa === "boolean") $set.activa = body.activa;
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return json({ error: "El nombre no puede quedar vacío" }, 400);
      $set.nombre = nombre;
    }
    if (body.objetivo !== undefined) $set.objetivo = String(body.objetivo).trim();
    const $unset: Record<string, 1> = {};
    if (body.frecuenciaVeces !== undefined || body.frecuenciaPeriodo !== undefined) {
      const frec = validarFrecuencia(body.frecuenciaVeces, body.frecuenciaPeriodo, body.frecuenciaDias);
      if ("error" in frec) return json({ error: frec.error }, 400);
      Object.assign($set, {
        frecuenciaVeces: frec.veces,
        frecuenciaPeriodo: frec.periodo,
        frecuencia: textoFrecuencia(frec.veces, frec.periodo, frec.dias),
      });
      if (frec.dias.length) $set.frecuenciaDias = frec.dias;
      else $unset.frecuenciaDias = 1; // sin días fijos
    }
    if (body.ejercicios !== undefined) {
      const v = validarEjercicios(body.ejercicios, session.userId);
      if ("error" in v) return json({ error: v.error }, 400);
      if (v.ejercicios.length === 0) return json({ error: "Agrega al menos un ejercicio" }, 400);
      const sinVideo = await ejercicioSinArchivo(v.ejercicios);
      if (sinVideo) return json({ error: `«${sinVideo}»: no se encontró el video, súbelo de nuevo` }, 400);
      $set.ejercicios = v.ejercicios;
    }
    if (!Object.keys($set).length) return json({ error: "No hay cambios que guardar" }, 400);

    await connectDB();
    // Se devuelve la versión anterior para saber qué videos dejaron de usarse
    const anterior = await Rutina.findOneAndUpdate(
      { _id: params.id, medico: session.userId },
      Object.keys($unset).length ? { $set, $unset } : { $set },
      { returnDocument: "before", runValidators: true },
    ).select("ejercicios.video");
    if (!anterior) return json({ error: "Rutina no encontrada" }, 404);

    if ($set.ejercicios) {
      const siguen = new Set(videosDe($set.ejercicios as { video?: string }[]));
      await borrarArchivos(videosDe(anterior.ejercicios).filter((v) => !siguen.has(v)));
    }

    const rutina = await Rutina.findById(params.id).populate("paciente", "nombre apellido email");
    return json(rutina);
  } catch (error) {
    console.error("PUT rutina error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Rutina inválida" }, 400);

    await connectDB();
    const rutina = await Rutina.findOneAndDelete({ _id: params.id, medico: session.userId });
    if (!rutina) return json({ error: "Rutina no encontrada" }, 404);
    await borrarArchivos(videosDe(rutina.ejercicios));
    return json({ success: true });
  } catch (error) {
    console.error("DELETE rutina error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
