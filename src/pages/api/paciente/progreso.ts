import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Progreso } from "../../../models/Progreso";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/paciente/progreso
export const GET: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const registros = await Progreso.find({ paciente: session.userId })
      .populate("rutina", "nombre")
      .sort({ fecha: -1 })
      .limit(30);

    return new Response(JSON.stringify(registros), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// POST /api/paciente/progreso - Registrar sesión completada
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    const body = await request.json();

    const progreso = await Progreso.create({
      ...body,
      paciente: session.userId,
    });

    return new Response(JSON.stringify(progreso), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
