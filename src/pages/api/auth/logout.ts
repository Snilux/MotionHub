import type { APIRoute } from "astro";
import { clearSessionCookie, getSessionFromRequest, json, sesionEstricta } from "../../../lib/session";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);

    // Libera la sesión del médico o administrador, pero solo si es la sesión vigente
    // (así cerrar una pestaña vieja no cierra la sesión nueva de otro navegador).
    if (session && sesionEstricta(session.role)) {
      await connectDB();
      await User.updateOne(
        { _id: session.userId, activeSessionToken: session.sessionId },
        { activeSessionToken: null, activeSessionExpires: null },
      );
    }
  } catch {
    // Silencioso: igual se limpia la cookie
  }

  return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
};
