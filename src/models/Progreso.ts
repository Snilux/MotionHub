import mongoose, { Schema, type Document } from "mongoose";
import { definirModelo } from "../lib/modelo";
// Modelos a los que apunta (ref): deben estar registrados para poder usar populate()
// aunque la página no los importe (en un servidor recién iniciado fallaría).
import "./User";
import "./Rutina";

export interface IProgreso extends Document {
  paciente: mongoose.Types.ObjectId;
  medico: mongoose.Types.ObjectId;
  rutina?: mongoose.Types.ObjectId;
  fecha: Date;
  dolorAntes: number; // 0-10
  dolorDespues: number; // 0-10
  notasPaciente?: string;
  notaVoz?: string; // ruta relativa en el volumen de subidas ("notas-voz/<pacienteId>-<ts>-<rand>.weba")
  notaVozDuracion?: number; // segundos
  ventana?: string; // ventana de registro según la frecuencia (ver ventanaRegistro en lib/rutina)
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
    notaVoz: { type: String },
    notaVozDuracion: { type: Number, min: 0 },
    ventana: { type: String },
    notasMedico: { type: String },
    completado: { type: Boolean, default: false },
    ejerciciosCompletados: { type: Number, default: 0 },
    totalEjercicios: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ProgresoSchema.index({ paciente: 1, fecha: -1 });
ProgresoSchema.index({ notaVoz: 1 }, { sparse: true }); // permisos de /archivos/notas-voz/...
// Una sola sesión por rutina en cada ventana (evita duplicados aunque lleguen dos envíos a la vez)
ProgresoSchema.index(
  { rutina: 1, ventana: 1 },
  { unique: true, partialFilterExpression: { ventana: { $exists: true } } },
);

export const Progreso = definirModelo<IProgreso>("Progreso", ProgresoSchema);
