import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { Cita } from "../../../models/Cita";
import { Rutina } from "../../../models/Rutina";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esIdValido } from "../../../lib/medico";

const CAMPOS_PRIVADOS = "-password -resetPasswordToken -resetPasswordExpires -activeSessionToken -activeSessionExpires -googleId";

// GET /api/medico/pacientes - Listar pacientes del médico
export const GET: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    await connectDB();
    const pacientes = await User.find({ role: "paciente", medicoAsignado: session.userId }).select(CAMPOS_PRIVADOS);
    return json(pacientes);
  } catch (error) {
    console.error("GET pacientes error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// POST /api/medico/pacientes - Asignar paciente al médico
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const { pacienteId } = await request.json();
    if (!esIdValido(pacienteId)) return json({ error: "Paciente inválido" }, 400);

    await connectDB();
    const paciente = await User.findOne({ _id: pacienteId, role: "paciente" }).populate(
      "medicoAsignado",
      "nombre apellido",
    );
    if (!paciente) return json({ error: "Paciente no encontrado" }, 404);

    const asignado: any = paciente.medicoAsignado;
    if (asignado) {
      if (String(asignado._id) === session.userId) {
        return json({ error: "Este paciente ya está asignado a ti.", codigo: "YA_ES_TUYO" }, 409);
      }
      return json(
        {
          error: `Este paciente ya está asignado a Dr. ${asignado.nombre} ${asignado.apellido}.`,
          codigo: "ASIGNADO_OTRO",
        },
        409,
      );
    }

    // Asignación atómica: solo si sigue sin médico (evita carreras entre médicos)
    const actualizado = await User.findOneAndUpdate(
      { _id: pacienteId, role: "paciente", medicoAsignado: { $in: [null, undefined] } },
      { $set: { medicoAsignado: session.userId } },
      { returnDocument: "after" },
    ).select(CAMPOS_PRIVADOS);
    if (!actualizado) return json({ error: "El paciente acaba de ser asignado a otro médico." }, 409);

    return json(actualizado);
  } catch (error) {
    console.error("POST pacientes error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// DELETE /api/medico/pacientes?id=... - Quitar al paciente de la lista del médico.
// No borra la cuenta del paciente ni su expediente: cancela sus citas futuras
// y pausa sus rutinas con este médico.
export const DELETE: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    const id = url.searchParams.get("id");
    if (!esIdValido(id)) return json({ error: "Paciente inválido" }, 400);

    await connectDB();
    const paciente = await User.findOneAndUpdate(
      { _id: id, role: "paciente", medicoAsignado: session.userId },
      { $set: { medicoAsignado: null } },
    );
    if (!paciente) return json({ error: "Paciente no encontrado" }, 404);

    await Promise.all([
      Cita.updateMany(
        { paciente: id, medico: session.userId, estado: { $in: ["pendiente", "confirmada"] }, fecha: { $gte: new Date() } },
        { $set: { estado: "cancelada" } },
      ),
      Rutina.updateMany({ paciente: id, medico: session.userId }, { $set: { activa: false } }),
    ]);

    return json({ success: true });
  } catch (error) {
    console.error("DELETE pacientes error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
