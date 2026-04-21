import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { signToken, createSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ request }) => {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Credenciales requeridas" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.role !== "medico") {
      return new Response(
        JSON.stringify({ error: "Credenciales incorrectas" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Credenciales incorrectas" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Forzar: generar nuevo sessionId, sobreescribir el anterior
    const { randomUUID } = await import("crypto");
    const sessionId = randomUUID();
    await User.updateOne({ _id: user._id }, { activeSessionToken: sessionId });

    const token = signToken({
      userId:    user._id.toString(),
      email:     user.email,
      role:      user.role,
      nombre:    user.nombre,
      sessionId,
    });

    return new Response(
      JSON.stringify({ success: true, redirect: "/dashboard/medico" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie":   createSessionCookie(token, "medico"),
        },
      }
    );
  } catch (error) {
    console.error("Forzar login error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};