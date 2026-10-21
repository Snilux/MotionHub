import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Cita } from "../../../models/Cita";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/medico/citas - Listar citas del médico
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

    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const estado = url.searchParams.get("estado");

    const filtro: Record<string, unknown> = { medico: session.userId };
    if (desde || hasta) {
      filtro.fecha = {
        ...(desde && { $gte: new Date(desde) }),
        ...(hasta && { $lte: new Date(hasta) }),
      };
    }
    if (estado) filtro.estado = estado;

    const citas = await Cita.find(filtro)
      .populate("paciente", "nombre apellido email telefono")
      .sort({ fecha: 1 });

    return new Response(JSON.stringify(citas), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET citas medico error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// POST /api/medico/citas - Crear cita
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

    const cita = await Cita.create({
      ...body,
      medico: session.userId,
    });

    const populated = await cita.populate("paciente", "nombre apellido email");

    return new Response(JSON.stringify(populated), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POST citas medico error:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
