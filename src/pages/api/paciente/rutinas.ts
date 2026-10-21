import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest } from "../../../lib/session";

// GET /api/paciente/rutinas
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

    const soloActivas = url.searchParams.get("activa");
    const filtro: Record<string, unknown> = { paciente: session.userId };
    if (soloActivas === "true") filtro.activa = true;

    const rutinas = await Rutina.find(filtro)
      .populate("medico", "nombre apellido especialidad")
      .sort({ createdAt: -1 });

    return new Response(JSON.stringify(rutinas), {
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
