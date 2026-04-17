import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IExpediente extends Document {
  paciente: mongoose.Types.ObjectId;
  medico: mongoose.Types.ObjectId;
  // Datos médicos
  diagnostico: string;
  motivoConsulta: string;
  antecedentes?: string;
  alergias?: string;
  medicamentos?: string;
  // Evaluación física
  altura?: number; // cm
  peso?: number; // kg
  presionArterial?: string;
  // Notas de evolución
  evolucion: {
    fecha: Date;
    nota: string;
    medico: mongoose.Types.ObjectId;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ExpedienteSchema = new Schema<IExpediente>(
  {
    paciente: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    medico: { type: Schema.Types.ObjectId, ref: "User", required: true },
    diagnostico: { type: String, required: true },
    motivoConsulta: { type: String, required: true },
    antecedentes: { type: String },
    alergias: { type: String },
    medicamentos: { type: String },
    altura: { type: Number },
    peso: { type: Number },
    presionArterial: { type: String },
    evolucion: [
      {
        fecha: { type: Date, default: Date.now },
        nota: { type: String, required: true },
        medico: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true },
);

export const Expediente = (mongoose.models.Expediente ||
  mongoose.model<IExpediente>(
    "Expediente",
    ExpedienteSchema,
  )) as Model<IExpediente>;
