// Almacenamiento de archivos subidos (fotos de perfil, etc.).
// En Docker vive en el volumen `uploads-data`, montado en UPLOADS_DIR (/data/uploads).
// En Mongo se guarda solo la ruta relativa ("avatars/<id>-<ts>.jpg"), nunca la absoluta,
// para poder mover el volumen o cambiar UPLOADS_DIR sin tocar la base.
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || "./uploads");

export const TIPOS_IMAGEN = {
  jpg: "image/jpeg",
  png: "image/png",
} as const;
export type ExtImagen = keyof typeof TIPOS_IMAGEN;

export const FOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Videos de ejercicios (carpeta "videos/" del mismo volumen)
export const TIPOS_VIDEO = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
} as const;
export type ExtVideo = keyof typeof TIPOS_VIDEO;

export const VIDEO_MAX_MB = 100;
export const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024;

// Notas de voz (carpeta "notas-voz/"). Cada navegador graba en un formato:
// Chrome/Edge/Firefox en WebM u Ogg (Opus) y Safari/iOS en MP4 (AAC).
export const TIPOS_AUDIO = {
  weba: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
} as const;
export type ExtAudio = keyof typeof TIPOS_AUDIO;

export const NOTA_VOZ_MAX_SEG = 180; // 3 minutos
export const NOTA_VOZ_MAX_BYTES = 5 * 1024 * 1024; // de sobra para 3 min de voz

/** Detecta JPG/PNG por su contenido (firma de bytes), no por el nombre del archivo. */
export function tipoImagen(buf: Uint8Array): ExtImagen | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 8 && png.every((b, i) => buf[i] === b)) return "png";
  return null;
}

/** Detecta MP4/MOV/WebM por su contenido (firma de bytes). */
export function tipoVideo(buf: Uint8Array): ExtVideo | null {
  // WebM / Matroska: cabecera EBML 1A 45 DF A3
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  // MP4 / MOV (ISO BMFF): "ftyp" en los bytes 4-7; la marca "qt  " indica QuickTime
  if (buf.length >= 12 && String.fromCharCode(...buf.subarray(4, 8)) === "ftyp") {
    return String.fromCharCode(...buf.subarray(8, 12)) === "qt  " ? "mov" : "mp4";
  }
  return null;
}

/** Detecta WebM/Ogg/MP4 de audio por su contenido (firma de bytes). */
export function tipoAudio(buf: Uint8Array): ExtAudio | null {
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return "ogg"; // "OggS"
  const video = tipoVideo(buf); // WebM y MP4 comparten firma con los videos
  if (video === "webm") return "weba";
  if (video === "mp4" || video === "mov") return "m4a";
  return null;
}

/** Convierte una ruta relativa en absoluta dentro de UPLOADS_DIR; null si intenta salir (../). */
export function rutaSegura(relativa: string): string | null {
  const abs = path.resolve(UPLOADS_DIR, relativa);
  return abs.startsWith(UPLOADS_DIR + path.sep) ? abs : null;
}

/** Guarda el archivo y devuelve su ruta relativa (lo que se guarda en Mongo). */
export async function guardarArchivo(carpeta: string, prefijo: string, ext: string, datos: Uint8Array): Promise<string> {
  const nombre = `${prefijo}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const relativa = path.posix.join(carpeta, nombre);
  const abs = rutaSegura(relativa);
  if (!abs) throw new Error("Ruta de archivo no válida");
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, datos);
  return relativa;
}

/** Borra un archivo; no falla si ya no existe. */
export async function borrarArchivo(relativa: string | null | undefined): Promise<void> {
  if (!relativa) return;
  const abs = rutaSegura(relativa);
  if (abs) await rm(abs, { force: true });
}

/** Lee un archivo; null si no existe o la ruta no es válida. */
export async function leerArchivo(relativa: string): Promise<Buffer | null> {
  const abs = rutaSegura(relativa);
  if (!abs) return null;
  try {
    return await readFile(abs);
  } catch {
    return null;
  }
}

/** Tamaño de un archivo; null si no existe o la ruta no es válida. */
export async function tamanoArchivo(relativa: string): Promise<number | null> {
  const abs = rutaSegura(relativa);
  if (!abs) return null;
  try {
    const info = await stat(abs);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

/** Borra varios archivos sin fallar (registra el error y sigue). */
export async function borrarArchivos(rutas: string[]): Promise<void> {
  await Promise.all(rutas.map((r) => borrarArchivo(r).catch((e) => console.error("Borrar archivo:", r, e))));
}

/** Content-Type según la extensión (solo los tipos que la app acepta). */
export function contentType(relativa: string): string | null {
  const ext = path.extname(relativa).slice(1).toLowerCase();
  if (ext === "jpeg") return TIPOS_IMAGEN.jpg;
  return (
    (TIPOS_IMAGEN as Record<string, string>)[ext] ??
    (TIPOS_VIDEO as Record<string, string>)[ext] ??
    (TIPOS_AUDIO as Record<string, string>)[ext] ??
    null
  );
}

/** URL pública (con sesión) de un archivo guardado. */
export const urlArchivo = (relativa: string | null | undefined) => (relativa ? `/archivos/${relativa}` : null);
