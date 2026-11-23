import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { Cita } from "../../../../models/Cita";
import { getSessionFromRequest, json } from "../../../../lib/session";
import { esIdValido, citaQueSeCruza, validarCita, mensajeCruce, ESTADOS_CITA } from "../../../../lib/medico";
import { notificarCita } from "../../../../lib/notificaciones";

// PUT /api/medico/cita/[id] - Editar, reagendar, confirmar, completar o cancelar
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Cita inválida" }, 400);

    const body = await request.json();
    await connectDB();

    const cita = await Cita.findOne({ _id: params.id, medico: session.userId });
    if (!cita) return json({ error: "Cita no encontrada" }, 404);

    const reagendar =
      body.fecha !== undefined && new Date(body.fecha).getTime() !== cita.fecha.getTime();

    const error = validarCita(
      { fecha: reagendar ? body.fecha : undefined, duracion: body.duracion, tipo: body.tipo },
      true,
    );
    if (error) return json({ error }, 400);
    if (body.estado !== undefined && !ESTADOS_CITA.includes(body.estado)) {
      return json({ error: "Estado inválido" }, 400);
    }

    const nuevaFecha = reagendar ? new Date(body.fecha) : cita.fecha;
    const nuevaDuracion = body.duracion !== undefined ? Number(body.duracion) : cita.duracion;
    const nuevoEstado = body.estado ?? (reagendar ? "pendiente" : cita.estado);

    // Si cambia el horario (o se reactiva una cancelada) comprobar cruces
    if ((reagendar || nuevaDuracion !== cita.duracion || cita.estado === "cancelada") && nuevoEstado !== "cancelada") {
      const cruce = await citaQueSeCruza(session.userId, nuevaFecha, nuevaDuracion, String(cita._id));
      if (cruce) return json({ error: mensajeCruce(cruce), codigo: "CRUCE" }, 409);
    }

    const fechaAnterior = cita.fecha;
    const estadoAnterior = cita.estado;

    cita.fecha = nuevaFecha;
    cita.duracion = nuevaDuracion;
    cita.estado = nuevoEstado;
    if (body.tipo !== undefined) cita.tipo = body.tipo;
    if (body.notas !== undefined) cita.notas = body.notas;
    if (body.notasMedico !== undefined) cita.notasMedico = body.notasMedico;
    if (nuevoEstado === "cancelada" && estadoAnterior !== "cancelada") {
      cita.canceladaPor = "medico";
      cita.motivoCancelacion = String(body.motivoCancelacion ?? "").trim().slice(0, 500) || undefined;
    } else if (nuevoEstado !== "cancelada") {
      cita.canceladaPor = cita.motivoCancelacion = undefined;
    }
    await cita.save();

    // Avisar al paciente por correo de los cambios que le afectan
    const origen = new URL(request.url).origin;
    if (nuevoEstado === "cancelada" && estadoAnterior !== "cancelada") {
      notificarCita(cita, "cancelada", { origen });
    } else if (estadoAnterior === "cancelada" && nuevoEstado !== "cancelada") {
      notificarCita(cita, "agendada", { origen }); // se reactivó
    } else if (reagendar && nuevoEstado !== "cancelada") {
      notificarCita(cita, "reagendada", { origen, fechaAnterior });
    }

    return json(await cita.populate("paciente", "nombre apellido email telefono"));
  } catch (error) {
    console.error("PUT cita error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// DELETE /api/medico/cita/[id] - Eliminar la cita definitivamente
export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Cita inválida" }, 400);

    await connectDB();
    const cita = await Cita.findOneAndDelete({ _id: params.id, medico: session.userId });
    if (!cita) return json({ error: "Cita no encontrada" }, 404);

    // Si el paciente esperaba esta cita, se le avisa de que ya no va
    if (cita.fecha > new Date() && (cita.estado === "pendiente" || cita.estado === "confirmada")) {
      notificarCita(cita, "cancelada", { origen: new URL(request.url).origin });
    }

    return json({ success: true });
  } catch (error) {
    console.error("DELETE cita error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
