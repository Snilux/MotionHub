import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Cita } from "../../../models/Cita";
import { getSessionFromRequest } from "../../../lib/session";

// PUT /api/medico/cita/[id] - Actualizar cita
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    const body = await request.json();

    const cita = await Cita.findOneAndUpdate(
      { _id: params.id, medico: session.userId },
      { $set: body },
      { new: true }
    ).populate("paciente", "nombre apellido email telefono");

    if (!cita) {
      return new Response(JSON.stringify({ error: "Cita no encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(cita), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PUT cita error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// DELETE /api/medico/cita/[id] - Cancelar cita
export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const cita = await Cita.findOneAndUpdate(
      { _id: params.id, medico: session.userId },
      { $set: { estado: "cancelada" } },
      { new: true }
    );

    if (!cita) {
      return new Response(JSON.stringify({ error: "Cita no encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("DELETE cita error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
