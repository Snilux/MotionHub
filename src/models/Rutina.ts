import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IEjercicio {
  nombre: string;
  descripcion: string;
  series: number;
  repeticiones: number;
  duracion?: number; // segundos
  descanso?: number; // segundos
  videoUrl?: string;
  imagenUrl?: string;
  notas?: string;
}

export interface IRutina extends Document {
  nombre: string;
  descripcion?: string;
  paciente: mongoose.Types.ObjectId;
  medico: mongoose.Types.ObjectId;
  ejercicios: IEjercicio[];
  frecuencia: string; // ej: "3 veces por semana"
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
    descripcion: { type: String, required: true },
    series: { type: Number, required: true },
    repeticiones: { type: Number, required: true },
    duracion: { type: Number },
    descanso: { type: Number, default: 30 },
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
    objetivo: { type: String },
    activa: { type: Boolean, default: true },
    fechaInicio: { type: Date, default: Date.now },
    fechaFin: { type: Date },
  },
  { timestamps: true },
);

RutinaSchema.index({ paciente: 1, activa: 1 });
RutinaSchema.index({ medico: 1 });

export const Rutina = (mongoose.models.Rutina ||
  mongoose.model<IRutina>("Rutina", RutinaSchema)) as Model<IRutina>;
