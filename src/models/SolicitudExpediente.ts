import mongoose, { Schema, type Document } from "mongoose";
import { definirModelo } from "../lib/modelo";
import { CAMPOS_SUGERIBLES, type CampoSugerible } from "../lib/expediente";

// Sugerencia del paciente para modificar su expediente. No cambia nada hasta
// que un médico asignado la revisa y la aprueba.
export interface ISolicitudExpediente extends Document {
  paciente: mongoose.Types.ObjectId;
  expediente: mongoose.Types.ObjectId;
  campo: CampoSugerible;
  valorAnterior?: string; // valor del campo cuando se hizo la sugerencia
  valorPropuesto: string;
  comentario?: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  // Revisión del médico
  valorAplicado?: string; // lo que finalmente se integró (el médico puede ajustarlo)
  respuesta?: string;
  revisadaPor?: mongoose.Types.ObjectId;
  revisadaEn?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SolicitudExpedienteSchema = new Schema<ISolicitudExpediente>(
  {
    paciente: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expediente: { type: Schema.Types.ObjectId, ref: "Expediente", required: true },
    campo: { type: String, enum: CAMPOS_SUGERIBLES, required: true },
    valorAnterior: { type: String },
    valorPropuesto: { type: String, required: true, maxlength: 1000 },
    comentario: { type: String, maxlength: 500 },
    estado: {
      type: String,
      enum: ["pendiente", "aprobada", "rechazada"],
      default: "pendiente",
    },
    valorAplicado: { type: String, maxlength: 1000 },
    respuesta: { type: String, maxlength: 500 },
    revisadaPor: { type: Schema.Types.ObjectId, ref: "User" },
    revisadaEn: { type: Date },
  },
  { timestamps: true },
);

SolicitudExpedienteSchema.index({ paciente: 1, estado: 1, createdAt: -1 });

export const SolicitudExpediente = definirModelo<ISolicitudExpediente>("SolicitudExpediente", SolicitudExpedienteSchema);
