import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest, json } from "../../../lib/session";
import { VIDEO_MAX_BYTES, VIDEO_MAX_MB, borrarArchivo, guardarArchivo, tipoVideo, urlArchivo } from "../../../lib/storage";
import { CARPETA_VIDEOS, esVideoDe } from "../../../lib/rutina";

// POST /api/medico/video - Sube el video de un ejercicio (multipart, campo "video").
// Se guarda en el volumen de subidas y devuelve su ruta; la rutina la referencia
// al guardarse (POST /api/medico/rutinas o PUT /api/medico/rutina/:id).
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const muyGrande = `El video no puede pesar más de ${VIDEO_MAX_MB} MB`;
    const largo = Number(request.headers.get("content-length") || 0);
    if (largo > VIDEO_MAX_BYTES + 64 * 1024) return json({ error: muyGrande }, 413);

    let archivo: FormDataEntryValue | null = null;
    try {
      archivo = (await request.formData()).get("video");
    } catch {
      return json({ error: "Formato de envío no válido" }, 400);
    }
    if (!archivo || typeof archivo === "string") return json({ error: "Selecciona un video" }, 400);
    if (archivo.size === 0) return json({ error: "El archivo está vacío" }, 400);
    if (archivo.size > VIDEO_MAX_BYTES) return json({ error: muyGrande }, 413);

    const datos = new Uint8Array(await archivo.arrayBuffer());
    const ext = tipoVideo(datos);
    if (!ext) return json({ error: "Solo se aceptan videos MP4, MOV o WebM" }, 415);

    const ruta = await guardarArchivo(CARPETA_VIDEOS, session.userId, ext, datos);
    return json({ success: true, video: ruta, url: urlArchivo(ruta) }, 201);
  } catch (error) {
    console.error("Subir video de ejercicio:", error);
    return json({ error: "No se pudo guardar el video" }, 500);
  }
};

// DELETE /api/medico/video?ruta=videos/... - Borra un video subido que aún no
// se guardó en ninguna rutina (p. ej. el médico lo cambió o canceló el formulario).
// Los videos que ya usa una rutina se borran al editarla o eliminarla.
export const DELETE: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const ruta = url.searchParams.get("ruta") ?? "";
    if (!esVideoDe(ruta, session.userId)) return json({ error: "Video no válido" }, 400);

    await connectDB();
    if (await Rutina.exists({ "ejercicios.video": ruta })) {
      return json({ success: true, enUso: true }); // lo borrará la rutina al dejar de usarlo
    }
    await borrarArchivo(ruta);
    return json({ success: true });
  } catch (error) {
    console.error("Borrar video de ejercicio:", error);
    return json({ error: "No se pudo borrar el video" }, 500);
  }
};
