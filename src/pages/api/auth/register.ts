import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { signToken, createSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ request }) => {
  try {
    await connectDB();

    const body = await request.json();
    const {
      nombre,
      apellido,
      email,
      password,
      role,
      telefono,
      fechaNacimiento,
      // Médico
      cedulaProfesional,
      especialidad,
      // Paciente
      diagnostico,
    } = body;

    // Validaciones
    if (!nombre || !apellido || !email || !password || !role) {
      return new Response(
        JSON.stringify({
          error: "Todos los campos obligatorios son requeridos",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!["medico", "paciente"].includes(role)) {
      return new Response(JSON.stringify({ error: "Rol inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({
          error: "La contraseña debe tener al menos 6 caracteres",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return new Response(
        JSON.stringify({ error: "Este correo ya está registrado" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = await User.create({
      nombre,
      apellido,
      email,
      password,
      role,
      telefono,
      fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
      ...(role === "medico" && { cedulaProfesional, especialidad }),
      ...(role === "paciente" && { diagnostico }),
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      nombre: user.nombre,
    });

    const redirectUrl =
      user.role === "medico" ? "/dashboard/medico" : "/dashboard/paciente";

    return new Response(
      JSON.stringify({ success: true, redirect: redirectUrl }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": createSessionCookie(token, user.role),
        },
      },
    );
  } catch (error) {
    console.error("Register error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
