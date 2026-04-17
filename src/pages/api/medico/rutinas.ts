import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/medico/rutinas
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const pacienteId = url.searchParams.get("paciente");
    const filtro: Record<string, unknown> = { medico: session.userId };
    if (pacienteId) filtro.paciente = pacienteId;

    const rutinas = await Rutina.find(filtro)
      .populate("paciente", "nombre apellido email")
      .sort({ createdAt: -1 });

    return new Response(JSON.stringify(rutinas), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET rutinas medico error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// POST /api/medico/rutinas - Crear rutina
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
    const body = await request.json();

    const rutina = await Rutina.create({
      ...body,
      medico: session.userId,
    });

    const populated = await rutina.populate("paciente", "nombre apellido email");

    return new Response(JSON.stringify(populated), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POST rutinas medico error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
