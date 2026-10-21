import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest } from "../../../lib/session";

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    const user = await User.findById(session.userId)
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .populate("medicoAsignado", "nombre apellido especialidad email telefono");

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Me error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
