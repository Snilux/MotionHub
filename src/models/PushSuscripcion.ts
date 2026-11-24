import mongoose, { Schema, type Document } from "mongoose";
import { definirModelo } from "../lib/modelo";
import "./User";

// Suscripción a notificaciones push de un navegador o de la app instalada (PWA).
// Un usuario puede tener varias (celular, computadora…); cada una tiene su endpoint.
export interface IPushSuscripcion extends Document {
  usuario: mongoose.Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  dispositivo?: string; // user-agent, para identificarla
  createdAt: Date;
}

const PushSuscripcionSchema = new Schema<IPushSuscripcion>(
  {
    usuario: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    dispositivo: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

export const PushSuscripcion = definirModelo<IPushSuscripcion>("PushSuscripcion", PushSuscripcionSchema);
