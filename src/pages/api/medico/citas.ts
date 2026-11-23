import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Cita } from "../../../models/Cita";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esMiPaciente, citaQueSeCruza, validarCita, mensajeCruce } from "../../../lib/medico";
import { notificarCita } from "../../../lib/notificaciones";

// GET /api/medico/citas - Listar citas del médico
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

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

    return json(citas);
  } catch (error) {
    console.error("GET citas medico error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// POST /api/medico/citas - Crear cita
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const { paciente, fecha, tipo = "tratamiento", duracion = 60, notas } = await request.json();

    await connectDB();
    if (!(await esMiPaciente(session.userId, paciente))) {
      return json({ error: "Selecciona uno de tus pacientes" }, 400);
    }

    const error = validarCita({ fecha, duracion, tipo });
    if (error) return json({ error }, 400);

    const inicio = new Date(fecha);
    const cruce = await citaQueSeCruza(session.userId, inicio, Number(duracion));
    if (cruce) return json({ error: mensajeCruce(cruce), codigo: "CRUCE" }, 409);

    const cita = await Cita.create({
      paciente,
      medico: session.userId,
      fecha: inicio,
      tipo,
      duracion: Number(duracion),
      notas: notas || undefined,
    });
    notificarCita(cita, "agendada", { origen: new URL(request.url).origin });

    const populated = await cita.populate("paciente", "nombre apellido email");
    return json(populated, 201);
  } catch (error) {
    console.error("POST citas medico error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
