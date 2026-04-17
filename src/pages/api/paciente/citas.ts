import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Cita } from "../../../models/Cita";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/paciente/citas
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const estado = url.searchParams.get("estado");
    const filtro: Record<string, unknown> = { paciente: session.userId };
    if (estado) filtro.estado = estado;

    const citas = await Cita.find(filtro)
      .populate("medico", "nombre apellido especialidad email telefono")
      .sort({ fecha: 1 });

    return new Response(JSON.stringify(citas), {
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
