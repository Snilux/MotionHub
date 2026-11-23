import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest, json } from "../../../lib/session";
import { escaparRegex } from "../../../lib/medico";
import { LIMITES, consumir, demasiadosIntentos } from "../../../lib/rateLimit";

// GET /api/medico/buscar-paciente?q=texto
// Busca pacientes por correo o por nombre/apellido. Cada resultado indica si
// ya está asignado a este médico ("tuyo"), a otro ("otro") o a nadie ("libre").
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    // Evita que se recorra el directorio de pacientes con búsquedas automáticas
    const espera = consumir(`buscar:${session.userId}`, LIMITES.busquedaMedico);
    if (espera) return demasiadosIntentos(espera);

    const q = (url.searchParams.get("q") ?? url.searchParams.get("email") ?? "").trim();
    if (q.length < 2) return json({ error: "Escribe al menos 2 caracteres" }, 400);

    await connectDB();

    // Cada palabra debe aparecer en el nombre, apellido o correo
    const palabras = q.split(/\s+/).filter(Boolean).map(escaparRegex);
    const filtro = {
      role: "paciente",
      $and: palabras.map((p) => {
        const re = new RegExp(p, "i");
        return { $or: [{ nombre: re }, { apellido: re }, { email: re }] };
      }),
    };

    const pacientes = await User.find(filtro)
      .select("_id nombre apellido email diagnostico medicoAsignado")
      .populate("medicoAsignado", "nombre apellido")
      .sort({ nombre: 1 })
      .limit(10)
      .lean();

    const resultados = pacientes.map((p: any) => ({
      _id: p._id,
      nombre: p.nombre,
      apellido: p.apellido,
      email: p.email,
      diagnostico: p.diagnostico,
      estado: !p.medicoAsignado
        ? "libre"
        : String(p.medicoAsignado._id) === session.userId
          ? "tuyo"
          : "otro",
      medico: p.medicoAsignado && String(p.medicoAsignado._id) !== session.userId
        ? `Dr. ${p.medicoAsignado.nombre} ${p.medicoAsignado.apellido}`
        : undefined,
    }));

    return json(resultados);
  } catch (error) {
    console.error("Buscar paciente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
