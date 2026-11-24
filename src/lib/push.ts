// Notificaciones push (Web Push con claves VAPID).
// Claves en .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (mailto: o https:).
// Se generan una vez con: npx web-push generate-vapid-keys
import webpush from "web-push";
import connectDB from "./db";
import { PushSuscripcion } from "../models/PushSuscripcion";

const env = (n: string) => ((import.meta.env as Record<string, string | undefined>)[n] ?? process.env[n])?.trim();

const vapid = {
  publica: env("VAPID_PUBLIC_KEY") ?? "",
  privada: env("VAPID_PRIVATE_KEY") ?? "",
  sujeto: env("VAPID_SUBJECT") || "mailto:soporte@motionhub.app",
};

export const pushConfigurado = () => !!vapid.publica && !!vapid.privada;
export const clavePublicaVapid = () => vapid.publica;

if (pushConfigurado()) webpush.setVapidDetails(vapid.sujeto, vapid.publica, vapid.privada);

export interface MensajePush {
  titulo: string;
  cuerpo: string;
  url?: string; // a dónde lleva al tocar la notificación
  etiqueta?: string; // misma etiqueta = reemplaza a la anterior en vez de acumularse
}

/** Envía a todos los dispositivos del usuario. Borra las suscripciones que ya no existen. Devuelve cuántas llegaron. */
export async function enviarPush(usuarioId: unknown, m: MensajePush): Promise<number> {
  if (!pushConfigurado()) return 0;
  await connectDB();
  const subs = await PushSuscripcion.find({ usuario: usuarioId }).lean();
  const payload = JSON.stringify({ title: m.titulo, body: m.cuerpo, url: m.url ?? "/", tag: m.etiqueta });

  let enviadas = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        // TTL: si el dispositivo está apagado, la notificación espera hasta 12 h
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 12 * 3600, urgency: "normal" });
        enviadas++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: el usuario quitó el permiso o desinstaló la app
        if (status === 404 || status === 410) await PushSuscripcion.deleteOne({ _id: s._id });
        else console.error("Push:", status ?? (e as Error).message);
      }
    }),
  );
  return enviadas;
}
