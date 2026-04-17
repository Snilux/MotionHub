import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IProgreso extends Document {
  paciente: mongoose.Types.ObjectId;
  medico: mongoose.Types.ObjectId;
  rutina?: mongoose.Types.ObjectId;
  fecha: Date;
  dolorAntes: number; // 0-10
  dolorDespues: number; // 0-10
  notasPaciente?: string;
  notasMedico?: string;
  completado: boolean;
  ejerciciosCompletados?: number;
  totalEjercicios?: number;
  createdAt: Date;
}

const ProgresoSchema = new Schema<IProgreso>(
  {
    paciente: { type: Schema.Types.ObjectId, ref: "User", required: true },
    medico: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rutina: { type: Schema.Types.ObjectId, ref: "Rutina" },
    fecha: { type: Date, default: Date.now },
    dolorAntes: { type: Number, min: 0, max: 10, default: 0 },
    dolorDespues: { type: Number, min: 0, max: 10, default: 0 },
    notasPaciente: { type: String },
    notasMedico: { type: String },
    completado: { type: Boolean, default: false },
    ejerciciosCompletados: { type: Number, default: 0 },
    totalEjercicios: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ProgresoSchema.index({ paciente: 1, fecha: -1 });

export const Progreso = (mongoose.models.Progreso ||
  mongoose.model<IProgreso>("Progreso", ProgresoSchema)) as Model<IProgreso>;
