import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Expediente } from "../../../models/Expediente";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/medico/expediente?paciente=id
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
    if (!pacienteId) {
      return new Response(JSON.stringify({ error: "paciente requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const expediente = await Expediente.findOne({
      paciente: pacienteId,
      medico: session.userId,
    }).populate("paciente", "nombre apellido email fechaNacimiento telefono");

    return new Response(JSON.stringify(expediente), {
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

// POST /api/medico/expediente - Crear expediente
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

    const expediente = await Expediente.create({
      ...body,
      medico: session.userId,
    });

    return new Response(JSON.stringify(expediente), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return new Response(
        JSON.stringify({ error: "El paciente ya tiene un expediente" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// PUT /api/medico/expediente - Actualizar / agregar nota de evolución
export const PUT: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();
    const { pacienteId, notaEvolucion, ...campos } = await request.json();

    const update: Record<string, unknown> = { $set: campos };
    if (notaEvolucion) {
      update.$push = {
        evolucion: {
          nota: notaEvolucion,
          medico: session.userId,
          fecha: new Date(),
        },
      };
    }

    const expediente = await Expediente.findOneAndUpdate(
      { paciente: pacienteId, medico: session.userId },
      update,
      { new: true }
    );

    if (!expediente) {
      return new Response(JSON.stringify({ error: "Expediente no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(expediente), {
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
