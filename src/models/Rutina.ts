import mongoose, { Schema, type Document } from "mongoose";
import { definirModelo } from "../lib/modelo";

export interface IEjercicio {
  nombre: string;
  descripcion: string;
  series: number;
  repeticiones: number;
  duracion?: number; // segundos
  descanso?: number; // segundos
  video?: string; // ruta relativa en el volumen de subidas ("videos/<medicoId>-<ts>-<rand>.mp4")
  videoUrl?: string; // enlace externo (legado)
  imagenUrl?: string;
  notas?: string;
}

export interface IRutina extends Document {
  nombre: string;
  descripcion?: string;
  paciente: mongoose.Types.ObjectId;
  medico: mongoose.Types.ObjectId;
  ejercicios: IEjercicio[];
  frecuencia: string; // texto legible, ej: "3 veces por semana"
  frecuenciaVeces?: number;
  frecuenciaPeriodo?: "dia" | "semana" | "mes";
  frecuenciaDias?: number[]; // días elegidos por el médico: de la semana (0 = dom) o del mes (1–28); vacío = cualquiera
  objetivo?: string;
  activa: boolean;
  fechaInicio: Date;
  fechaFin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EjercicioSchema = new Schema<IEjercicio>(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, default: "" },
    series: { type: Number, required: true },
    repeticiones: { type: Number, required: true },
    duracion: { type: Number },
    descanso: { type: Number, default: 30 },
    video: { type: String },
    videoUrl: { type: String },
    imagenUrl: { type: String },
    notas: { type: String },
  },
  { _id: false },
);

const RutinaSchema = new Schema<IRutina>(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String },
    paciente: { type: Schema.Types.ObjectId, ref: "User", required: true },
    medico: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ejercicios: [EjercicioSchema],
    frecuencia: { type: String, required: true },
    frecuenciaVeces: { type: Number, min: 1 },
    frecuenciaPeriodo: { type: String, enum: ["dia", "semana", "mes"] },
    frecuenciaDias: { type: [Number], default: undefined },
    objetivo: { type: String },
    activa: { type: Boolean, default: true },
    fechaInicio: { type: Date, default: Date.now },
    fechaFin: { type: Date },
  },
  { timestamps: true },
);

RutinaSchema.index({ paciente: 1, activa: 1 });
RutinaSchema.index({ medico: 1 });
RutinaSchema.index({ "ejercicios.video": 1 }, { sparse: true }); // permisos de /archivos/videos/...

export const Rutina = definirModelo<IRutina>("Rutina", RutinaSchema);
