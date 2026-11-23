import mongoose from "mongoose";
import { hora, diaRelativo } from "../components/dashboard/styles";
import { User } from "../models/User";
import { Cita } from "../models/Cita";

export const esIdValido = (id: unknown): id is string =>
  typeof id === "string" && mongoose.isValidObjectId(id);

/** ¿El paciente está asignado a este médico? */
export async function esMiPaciente(medicoId: string, pacienteId: unknown): Promise<boolean> {
  if (!esIdValido(pacienteId)) return false;
  return !!(await User.exists({ _id: pacienteId, role: "paciente", medicoAsignado: medicoId }));
}

/** Escapa un texto para usarlo dentro de una RegExp. */
export const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const TIPOS_CITA = ["evaluacion", "tratamiento", "seguimiento", "alta"] as const;
export const ESTADOS_CITA = ["pendiente", "confirmada", "completada", "cancelada"] as const;

/**
 * Busca una cita del médico que se cruce con el horario [inicio, inicio + duracion).
 * `excluir` permite ignorar la propia cita al reagendar.
 */
export async function citaQueSeCruza(medicoId: string, inicio: Date, duracion: number, excluir?: string) {
  const fin = new Date(inicio.getTime() + duracion * 60_000);
  const candidatas = await Cita.find({
    medico: medicoId,
    estado: { $ne: "cancelada" },
    fecha: { $lt: fin, $gt: new Date(inicio.getTime() - 24 * 60 * 60_000) },
    ...(excluir && { _id: { $ne: excluir } }),
  }).populate("paciente", "nombre apellido");

  return candidatas.find((c) => c.fecha.getTime() + (c.duracion ?? 60) * 60_000 > inicio.getTime()) ?? null;
}

/** Valida los datos comunes de una cita (crear o editar). Devuelve un mensaje de error o null. */
export function validarCita(datos: { fecha?: unknown; duracion?: unknown; tipo?: unknown }, parcial = false) {
  if (!parcial || datos.fecha !== undefined) {
    const f = new Date(String(datos.fecha));
    if (!datos.fecha || isNaN(f.getTime())) return "Fecha y hora inválidas";
    if (f.getTime() < Date.now() - 60_000) return "No puedes agendar una cita en el pasado";
  }
  if (datos.duracion !== undefined) {
    const d = Number(datos.duracion);
    if (!Number.isFinite(d) || d < 15 || d > 240) return "La duración debe estar entre 15 y 240 minutos";
  }
  if (datos.tipo !== undefined && !TIPOS_CITA.includes(datos.tipo as any)) return "Tipo de cita inválido";
  return null;
}

export const mensajeCruce = (c: any) =>
  `Ese horario se cruza con la cita de ${c.paciente?.nombre ?? "otro paciente"} ${c.paciente?.apellido ?? ""} (${diaRelativo(c.fecha)}, ${hora(c.fecha)}).`;

