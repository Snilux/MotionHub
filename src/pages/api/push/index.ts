import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { getSessionFromRequest, json } from "../../../lib/session";
import { clavePublicaVapid, pushConfigurado } from "../../../lib/push";
import { PushSuscripcion } from "../../../models/PushSuscripcion";

// GET /api/push - Clave pública VAPID (para suscribirse) y si este dispositivo ya está suscrito
export const GET: APIRoute = async ({ request, url }) => {
  const session = getSessionFromRequest(request);
  if (!session) return json({ error: "No autenticado" }, 401);
  if (!pushConfigurado()) return json({ configurado: false });

  const endpoint = url.searchParams.get("endpoint");
  let suscrito = false;
  if (endpoint) {
    await connectDB();
    suscrito = !!(await PushSuscripcion.exists({ endpoint, usuario: session.userId }));
  }
  return json({ configurado: true, clavePublica: clavePublicaVapid(), suscrito });
};

const esUrlPush = (u: unknown) => {
  try {
    return new URL(String(u)).protocol === "https:";
  } catch {
    return false;
  }
};

// POST /api/push - Guarda la suscripción de este dispositivo { endpoint, keys: { p256dh, auth } }
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return json({ error: "No autenticado" }, 401);
    if (!pushConfigurado()) return json({ error: "Las notificaciones no están configuradas en el servidor" }, 503);

    const body = await request.json().catch(() => ({}));
    const { endpoint, keys } = body ?? {};
    if (!esUrlPush(endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      return json({ error: "Suscripción inválida" }, 400);
    }

    await connectDB();
    // Un mismo dispositivo puede cambiar de cuenta: la suscripción pasa al usuario actual
    await PushSuscripcion.updateOne(
      { endpoint },
      {
        $set: {
          usuario: session.userId,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          dispositivo: (request.headers.get("user-agent") ?? "").slice(0, 300),
        },
      },
      { upsert: true },
    );
    return json({ success: true }, 201);
  } catch (error) {
    console.error("POST push:", error);
    return json({ error: "No se pudo activar las notificaciones" }, 500);
  }
};

// DELETE /api/push - Quita la suscripción de este dispositivo { endpoint }
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return json({ error: "No autenticado" }, 401);
    const { endpoint } = await request.json().catch(() => ({}));
    if (typeof endpoint !== "string") return json({ error: "Suscripción inválida" }, 400);
    await connectDB();
    await PushSuscripcion.deleteOne({ endpoint, usuario: session.userId });
    return json({ success: true });
  } catch (error) {
    console.error("DELETE push:", error);
    return json({ error: "No se pudo desactivar las notificaciones" }, 500);
  }
};
