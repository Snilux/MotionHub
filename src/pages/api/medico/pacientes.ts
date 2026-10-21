import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/medico/pacientes - Listar pacientes del médico
export const GET: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const pacientes = await User.find({
      role: "paciente",
      medicoAsignado: session.userId,
    }).select("-password -resetPasswordToken -resetPasswordExpires");

    return new Response(JSON.stringify(pacientes), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET pacientes error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// POST /api/medico/pacientes - Asignar paciente al médico
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    const { pacienteId } = await request.json();

    const paciente = await User.findOneAndUpdate(
      { _id: pacienteId, role: "paciente" },
      { $set: { medicoAsignado: session.userId } },
      { new: true }
    ).select("-password -resetPasswordToken -resetPasswordExpires");

    if (!paciente) {
      return new Response(JSON.stringify({ error: "Paciente no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(paciente), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POST pacientes error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
