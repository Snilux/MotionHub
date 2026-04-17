import type { APIRoute } from "astro";
import {
  clearSessionCookie,
  getSessionFromRequest,
} from "../../../lib/session";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);

    // Limpiar sessionId en DB (médicos) para liberar la sesión
    if (session?.role === "medico") {
      await connectDB();
      await User.updateOne(
        { _id: session.userId },
        { activeSessionToken: null },
      );
    }
  } catch {
    // Silencioso: igual se limpia la cookie
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
};
