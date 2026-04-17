import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ICita extends Document {
  paciente: mongoose.Types.ObjectId;
  medico: mongoose.Types.ObjectId;
  fecha: Date;
  duracion: number; // minutos
  tipo: "evaluacion" | "tratamiento" | "seguimiento" | "alta";
  estado: "pendiente" | "confirmada" | "completada" | "cancelada";
  notas?: string;
  notasMedico?: string;
  sala?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CitaSchema = new Schema<ICita>(
  {
    paciente: { type: Schema.Types.ObjectId, ref: "User", required: true },
    medico: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fecha: { type: Date, required: true },
    duracion: { type: Number, default: 60 },
    tipo: {
      type: String,
      enum: ["evaluacion", "tratamiento", "seguimiento", "alta"],
      default: "tratamiento",
    },
    estado: {
      type: String,
      enum: ["pendiente", "confirmada", "completada", "cancelada"],
      default: "pendiente",
    },
    notas: { type: String },
    notasMedico: { type: String },
    sala: { type: String },
  },
  { timestamps: true },
);

CitaSchema.index({ medico: 1, fecha: 1 });
CitaSchema.index({ paciente: 1, fecha: 1 });

export const Cita = (mongoose.models.Cita ||
  mongoose.model<ICita>("Cita", CitaSchema)) as Model<ICita>;
