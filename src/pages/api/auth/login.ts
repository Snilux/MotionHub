import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { signToken, createSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ request }) => {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email y contraseña son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Credenciales incorrectas" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Credenciales incorrectas" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generar sessionId único
    const { randomUUID } = await import("crypto");
    const sessionId = randomUUID();

    // Para médicos: guardar sessionId en DB → invalida sesiones anteriores
    if (user.role === "medico") {
      await User.updateOne(
        { _id: user._id },
        { activeSessionToken: sessionId },
      );
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      sessionId,
    });

    const redirectUrl =
      user.role === "medico" ? "/dashboard/medico" : "/dashboard/paciente";

    return new Response(
      JSON.stringify({ success: true, redirect: redirectUrl }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": createSessionCookie(token, user.role),
        },
      },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
