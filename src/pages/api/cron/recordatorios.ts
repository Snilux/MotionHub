import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { json } from "../../../lib/session";
import { enviarRecordatorios } from "../../../lib/recordatorios";

// POST /api/cron/recordatorios - Envía los recordatorios del día (correo + push).
// Lo llama el servicio "cron" de docker-compose cada mañana. Protegido con el
// encabezado "Authorization: Bearer <CRON_SECRET>" (variable en .env).
// ?simular=1 devuelve a quién se le enviaría y qué, sin enviar nada.
const secreto = () => ((import.meta.env.CRON_SECRET as string | undefined) ?? process.env.CRON_SECRET ?? "").trim();

const autorizado = (request: Request) => {
  const esperado = secreto();
  const recibido = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (esperado.length < 16 || recibido.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
};

export const POST: APIRoute = async ({ request, url }) => {
  if (secreto().length < 16) return json({ error: "CRON_SECRET no está configurado" }, 503);
  if (!autorizado(request)) return json({ error: "No autorizado" }, 401);
  try {
    const resultado = await enviarRecordatorios({ simular: url.searchParams.get("simular") === "1" });
    console.info("Recordatorios:", JSON.stringify({ ...resultado, detalle: undefined }));
    return json(resultado);
  } catch (error) {
    console.error("Recordatorios:", error);
    return json({ error: "No se pudieron enviar los recordatorios" }, 500);
  }
};
