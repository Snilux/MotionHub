import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest, json } from "../../../lib/session";
import { FOTO_MAX_BYTES, borrarArchivo, guardarArchivo, tipoImagen, urlArchivo } from "../../../lib/storage";

// POST /api/perfil/foto - Sube o reemplaza la foto de perfil (multipart, campo "foto")
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return json({ error: "No autenticado" }, 401);

    // Corte temprano si el cuerpo ya es demasiado grande (el multipart añade algo de encabezado)
    const largo = Number(request.headers.get("content-length") || 0);
    if (largo > FOTO_MAX_BYTES + 64 * 1024) return json({ error: "La foto no puede pesar más de 2 MB" }, 413);

    let archivo: FormDataEntryValue | null = null;
    try {
      archivo = (await request.formData()).get("foto");
    } catch {
      return json({ error: "Formato de envío no válido" }, 400);
    }
    if (!archivo || typeof archivo === "string") return json({ error: "Selecciona una imagen" }, 400);
    if (archivo.size === 0) return json({ error: "El archivo está vacío" }, 400);
    if (archivo.size > FOTO_MAX_BYTES) return json({ error: "La foto no puede pesar más de 2 MB" }, 413);

    const datos = new Uint8Array(await archivo.arrayBuffer());
    const ext = tipoImagen(datos);
    if (!ext) return json({ error: "Solo se aceptan imágenes JPG o PNG" }, 415);

    await connectDB();
    const user = await User.findById(session.userId).select("fotoPerfil");
    if (!user) return json({ error: "Usuario no encontrado" }, 404);

    const anterior = user.fotoPerfil;
    const nueva = await guardarArchivo("avatars", String(user._id), ext, datos);
    try {
      user.fotoPerfil = nueva;
      await user.save();
    } catch (error) {
      await borrarArchivo(nueva); // no dejar el archivo huérfano si falla la DB
      throw error;
    }
    if (anterior && anterior !== nueva) await borrarArchivo(anterior).catch(() => {});

    return json({ success: true, url: urlArchivo(nueva) });
  } catch (error) {
    console.error("Subir foto de perfil:", error);
    return json({ error: "No se pudo guardar la foto" }, 500);
  }
};

// DELETE /api/perfil/foto - Quita la foto de perfil
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return json({ error: "No autenticado" }, 401);

    await connectDB();
    const user = await User.findById(session.userId).select("fotoPerfil");
    if (!user) return json({ error: "Usuario no encontrado" }, 404);

    const anterior = user.fotoPerfil;
    user.fotoPerfil = undefined;
    await user.save();
    await borrarArchivo(anterior).catch(() => {});

    return json({ success: true });
  } catch (error) {
    console.error("Quitar foto de perfil:", error);
    return json({ error: "No se pudo quitar la foto" }, 500);
  }
};
