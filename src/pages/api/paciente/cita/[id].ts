import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { Cita } from "../../../../models/Cita";
import { getSessionFromRequest, json } from "../../../../lib/session";
import { esIdValido } from "../../../../lib/medico";
import { notificarCita } from "../../../../lib/notificaciones";

// PUT /api/paciente/cita/[id] - El paciente confirma o cancela una de sus citas
// Body: { accion: "confirmar" | "cancelar", motivo?: string }
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Cita inválida" }, 400);

    const { accion, motivo } = await request.json().catch(() => ({}));
    if (accion !== "confirmar" && accion !== "cancelar") return json({ error: "Acción inválida" }, 400);

    await connectDB();
    const cita = await Cita.findOne({ _id: params.id, paciente: session.userId });
    if (!cita) return json({ error: "Cita no encontrada" }, 404);

    if (cita.fecha <= new Date()) {
      return json({ error: "Esta cita ya pasó. Si hay un error, comunícate con tu fisioterapeuta." }, 400);
    }

    if (accion === "confirmar") {
      if (cita.estado !== "pendiente") return json({ error: `La cita ya está ${cita.estado}` }, 409);
      cita.estado = "confirmada";
    } else {
      if (cita.estado !== "pendiente" && cita.estado !== "confirmada") {
        return json({ error: `La cita ya está ${cita.estado}` }, 409);
      }
      cita.estado = "cancelada";
      cita.canceladaPor = "paciente";
      cita.motivoCancelacion = String(motivo ?? "").trim().slice(0, 500) || undefined;
    }
    await cita.save();

    notificarCita(cita, accion === "confirmar" ? "confirmada_paciente" : "cancelada_paciente", {
      origen: new URL(request.url).origin,
    });

    return json({ success: true, estado: cita.estado });
  } catch (error) {
    console.error("PUT cita paciente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
