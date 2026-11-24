import { tamanoArchivo } from "./storage";
import connectDB from "./db";
import { Rutina } from "../models/Rutina";

// Frecuencia, días y reglas de registro: ver lib/frecuencia.ts (sin dependencias de servidor)
export { PERIODOS, textoFrecuencia, validarFrecuencia, type Periodo } from "./frecuencia";

export interface EjercicioInput {
  nombre?: unknown;
  descripcion?: unknown;
  series?: unknown;
  repeticiones?: unknown;
  descanso?: unknown;
  duracion?: unknown;
  video?: unknown;
}

/** Carpeta del volumen de subidas donde viven los videos de ejercicios. */
export const CARPETA_VIDEOS = "videos";

/** Un video solo es válido si lo subió este médico (el nombre empieza con su id). */
export const esVideoDe = (ruta: string, medicoId: string) =>
  new RegExp(`^${CARPETA_VIDEOS}/${medicoId}-\\d+-[0-9a-f]{8}\\.(mp4|webm|mov)$`).test(ruta);

/**
 * ¿Puede este usuario ver el video? Solo el médico que creó la rutina y el
 * paciente al que está asignada. El médico que lo subió también puede verlo
 * mientras aún no está guardado en ninguna rutina (vista previa del formulario).
 */
export async function puedeVerVideo(ruta: string, userId: string): Promise<boolean> {
  if (esVideoDe(ruta, userId)) return true;
  await connectDB();
  return !!(await Rutina.exists({
    "ejercicios.video": ruta,
    $or: [{ medico: userId }, { paciente: userId }],
  }));
}

/** Rutas de video usadas por una lista de ejercicios. */
export const videosDe = (ejercicios: { video?: string | null }[] = []) =>
  ejercicios.map((e) => e.video).filter((v): v is string => !!v);

/** Nombre del primer ejercicio cuyo video no existe en el volumen (null si todos existen). */
export async function ejercicioSinArchivo(ejercicios: { nombre: string; video?: string }[]) {
  for (const e of ejercicios) {
    if (e.video && (await tamanoArchivo(e.video)) === null) return e.nombre;
  }
  return null;
}

/** Valida y normaliza los ejercicios. Devuelve { error } o { ejercicios }. */
export function validarEjercicios(lista: unknown, medicoId: string) {
  if (!Array.isArray(lista)) return { error: "Ejercicios inválidos" };
  const vistos = new Set<string>();
  const ejercicios = [];
  for (const [i, e] of (lista as EjercicioInput[]).entries()) {
    const nombre = String(e.nombre ?? "").trim();
    if (!nombre) return { error: `El ejercicio ${i + 1} no tiene nombre` };
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) return { error: `El ejercicio «${nombre}» está repetido` };
    vistos.add(clave);

    const series = Number(e.series);
    const repeticiones = Number(e.repeticiones);
    const descanso = Number(e.descanso ?? 30);
    if (!Number.isInteger(series) || series < 1 || series > 50) return { error: `«${nombre}»: las series deben ser entre 1 y 50` };
    if (!Number.isInteger(repeticiones) || repeticiones < 1 || repeticiones > 500) return { error: `«${nombre}»: las repeticiones deben ser entre 1 y 500` };
    if (!Number.isFinite(descanso) || descanso < 0 || descanso > 600) return { error: `«${nombre}»: el descanso debe ser entre 0 y 600 segundos` };

    const video = e.video ? String(e.video) : undefined;
    if (video && !esVideoDe(video, medicoId)) return { error: `«${nombre}»: el video no es válido, súbelo de nuevo` };

    ejercicios.push({
      nombre,
      descripcion: String(e.descripcion ?? "").trim(),
      series,
      repeticiones,
      descanso,
      video,
    });
  }
  return { ejercicios };
}
