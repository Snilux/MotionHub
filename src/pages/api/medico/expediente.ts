import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Expediente } from "../../../models/Expediente";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esMiPaciente } from "../../../lib/medico";
import { CAMPOS, esNumerico, valorCampo } from "../../../lib/expediente";

// Campos que el médico puede capturar/editar
function limpiar(body: Record<string, unknown>) {
  const datos: Record<string, unknown> = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    datos[c] = esNumerico(c) ? valorCampo(c, body[c]) : String(body[c] ?? "").trim();
  }
  return datos;
}

// GET /api/medico/expediente?paciente=id
// El expediente pertenece al paciente: lo ve el médico que lo tiene asignado,
// aunque lo haya creado otro fisioterapeuta.
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    await connectDB();
    const pacienteId = url.searchParams.get("paciente");
    if (!(await esMiPaciente(session.userId, pacienteId))) return json({ error: "Paciente no encontrado" }, 404);

    const expediente = await Expediente.findOne({ paciente: pacienteId })
      .populate("paciente", "nombre apellido email fechaNacimiento telefono");
    return json(expediente);
  } catch (error) {
    console.error("GET expediente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// POST /api/medico/expediente - Crear expediente
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const body = await request.json();
    await connectDB();
    if (!(await esMiPaciente(session.userId, body.paciente))) {
      return json({ error: "Selecciona uno de tus pacientes" }, 400);
    }

    const datos = limpiar(body);
    if (!datos.diagnostico || !datos.motivoConsulta) {
      return json({ error: "Diagnóstico y motivo de consulta son requeridos" }, 400);
    }

    const expediente = await Expediente.create({ ...datos, paciente: body.paciente, medico: session.userId });
    return json(expediente, 201);
  } catch (error: any) {
    if (error.code === 11000) return json({ error: "El paciente ya tiene un expediente" }, 409);
    console.error("POST expediente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// PUT /api/medico/expediente - Actualizar datos y/o agregar nota de evolución
export const PUT: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const { pacienteId, notaEvolucion, ...resto } = await request.json();
    await connectDB();
    if (!(await esMiPaciente(session.userId, pacienteId))) return json({ error: "Paciente no encontrado" }, 404);

    const datos = limpiar(resto);
    if (datos.diagnostico === "" || datos.motivoConsulta === "") {
      return json({ error: "Diagnóstico y motivo de consulta no pueden quedar vacíos" }, 400);
    }

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    for (const [k, v] of Object.entries(datos)) {
      if (v === undefined || v === "") $unset[k] = 1;
      else $set[k] = v;
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (typeof notaEvolucion === "string" && notaEvolucion.trim()) {
      update.$push = { evolucion: { nota: notaEvolucion.trim(), medico: session.userId, fecha: new Date() } };
    }
    if (!Object.keys(update).length) return json({ error: "No hay cambios que guardar" }, 400);

    const expediente = await Expediente.findOneAndUpdate({ paciente: pacienteId }, update, { returnDocument: "after" });
    if (!expediente) return json({ error: "Expediente no encontrado" }, 404);

    return json(expediente);
  } catch (error) {
    console.error("PUT expediente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
