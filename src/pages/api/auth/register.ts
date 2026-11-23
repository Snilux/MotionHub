import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { iniciarSesion } from "../../../lib/auth";
import { errorPassword } from "../../../lib/password";
import { LIMITES, consumir, demasiadosIntentos, ipCliente } from "../../../lib/rateLimit";
import { json } from "../../../lib/session";
import { datosProfesionales } from "../../../lib/verificacion";
import { notificarMedicoPorVerificar } from "../../../lib/notificaciones";

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    // Frena la creación masiva de cuentas y el sondeo de correos registrados
    const espera = consumir(`registro:ip:${ipCliente(context)}`, LIMITES.registroIp);
    if (espera) return demasiadosIntentos(espera);

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

    if (!String(nombre).trim() || !String(apellido).trim()) {
      return json({ error: "Nombre y apellido son requeridos" }, 400);
    }

    // Médicos: cédula y especialidad obligatorias; la cuenta queda pendiente de verificación
    const profesional = role === "medico" ? datosProfesionales({ cedulaProfesional, especialidad }) : null;
    if (profesional && "error" in profesional) return json({ error: profesional.error }, 400);

    const errorPass = errorPassword(password);
    if (errorPass) {
      return new Response(JSON.stringify({ error: errorPass }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return new Response(
        JSON.stringify({ error: "Este correo ya está registrado" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = await User.create({
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      email,
      password,
      role,
      telefono,
      fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
      ...(profesional && { ...profesional, estadoVerificacion: "pendiente" }),
      ...(role === "paciente" && { diagnostico }),
    });
    if (profesional) notificarMedicoPorVerificar(user._id, { origen: new URL(request.url).origin });

    // Inicia sesión (registra la sesión única si es médico)
    const { cookie, redirect } = await iniciarSesion(user);

    return new Response(JSON.stringify({ success: true, redirect }), {
      status: 201,
      headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
    });
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
