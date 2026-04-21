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
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
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

    // Para médicos: verificar si ya hay una sesión activa → bloquear nuevo login
    if (user.role === "medico") {
      if (user.activeSessionToken) {
        return new Response(
          JSON.stringify({
            error: "Ya tienes una sesión activa en otro dispositivo o navegador. Cierra esa sesión antes de iniciar una nueva.",
            codigo: "SESION_ACTIVA",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      // Sin sesión activa: registrar la nueva
      const { randomUUID } = await import("crypto");
      const sessionId = randomUUID();
      await User.updateOne({ _id: user._id }, { activeSessionToken: sessionId });

      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        nombre: user.nombre,
        sessionId,
      });

      return new Response(JSON.stringify({ success: true, redirect: "/dashboard/medico" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": createSessionCookie(token, "medico"),
        },
      });
    }

    // Pacientes: sesión normal sin restricción de unicidad
    const { randomUUID } = await import("crypto");
    const sessionId = randomUUID();
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      sessionId,
    });

    return new Response(JSON.stringify({ success: true, redirect: "/dashboard/paciente" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createSessionCookie(token, "paciente"),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};