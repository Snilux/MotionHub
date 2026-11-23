import type { APIRoute } from "astro";
import { json } from "../../../lib/session";

// GET /api/admin/sesion → el middleware valida y renueva la sesión; aquí solo respondemos OK
export const GET: APIRoute = async () => json({ ok: true });
