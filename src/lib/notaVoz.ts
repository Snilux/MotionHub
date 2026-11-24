// Notas de voz que el paciente graba al registrar una sesión.
// Se guardan en el volumen de subidas (carpeta "notas-voz/") y en Mongo solo la ruta.
import connectDB from "./db";
import { Progreso } from "../models/Progreso";

export const CARPETA_NOTAS_VOZ = "notas-voz";

/**
 * ¿Puede este usuario escuchar la nota? Solo el paciente que la grabó y el
 * médico de la rutina (el que quedó registrado en la sesión).
 */
export async function puedeOirNotaVoz(ruta: string, userId: string): Promise<boolean> {
  await connectDB();
  return !!(await Progreso.exists({ notaVoz: ruta, $or: [{ paciente: userId }, { medico: userId }] }));
}
