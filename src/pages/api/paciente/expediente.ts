import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Expediente } from "../../../models/Expediente";
import { SolicitudExpediente } from "../../../models/SolicitudExpediente";
import { User } from "../../../models/User";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esIdValido } from "../../../lib/medico";
import { notificarSugerencia } from "../../../lib/notificaciones";
import { CAMPOS_SUGERIBLES, esNumerico, textoCampo, valorCampo, type CampoExpediente } from "../../../lib/expediente";

const MAX_PENDIENTES = 10;

// GET /api/paciente/expediente - Su expediente (solo lectura) y sus sugerencias
export const GET: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") return json({ error: "No autorizado" }, 403);

    await connectDB();
    const [expediente, solicitudes] = await Promise.all([
      Expediente.findOne({ paciente: session.userId }).populate("medico", "nombre apellido"),
      SolicitudExpediente.find({ paciente: session.userId }).sort({ createdAt: -1 }).limit(50),
    ]);
    return json({ expediente, solicitudes });
  } catch (error) {
    console.error("GET expediente paciente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// POST /api/paciente/expediente - Sugerir una modificación (la revisa su médico)
export const POST: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") return json({ error: "No autorizado" }, 403);

    const body = await request.json().catch(() => ({}));
    const campo = body.campo;
    if (!CAMPOS_SUGERIBLES.includes(campo)) return json({ error: "Campo inválido" }, 400);

    const valorPropuesto = String(body.valorPropuesto ?? "").trim();
    const comentario = String(body.comentario ?? "").trim();
    if (!valorPropuesto) return json({ error: "Escribe tu sugerencia" }, 400);
    if (valorPropuesto.length > 1000) return json({ error: "La sugerencia es demasiado larga (máx. 1000 caracteres)" }, 400);
    if (comentario.length > 500) return json({ error: "El comentario es demasiado largo (máx. 500 caracteres)" }, 400);
    if (esNumerico(campo) && valorCampo(campo, valorPropuesto) === undefined) {
      return json({ error: "Escribe un número válido mayor a 0" }, 400);
    }

    await connectDB();
    const [expediente, paciente] = await Promise.all([
      Expediente.findOne({ paciente: session.userId }),
      User.findById(session.userId).select("medicoAsignado").lean(),
    ]);
    if (!expediente) return json({ error: "Aún no tienes un expediente" }, 404);
    if (!paciente?.medicoAsignado) return json({ error: "No tienes un fisioterapeuta asignado que pueda revisarla" }, 409);

    const valorAnterior = campo === "otro" ? "" : textoCampo(expediente, campo);
    if (campo !== "otro" && String(valorCampo(campo as CampoExpediente, valorPropuesto)) === valorAnterior) {
      return json({ error: "Es igual a lo que ya está en tu expediente" }, 400);
    }

    const pendientes = await SolicitudExpediente.find({ paciente: session.userId, estado: "pendiente" }).select("campo").lean();
    if (pendientes.length >= MAX_PENDIENTES) {
      return json({ error: `Tienes ${MAX_PENDIENTES} sugerencias pendientes. Espera a que tu fisioterapeuta las revise.` }, 429);
    }
    if (campo !== "otro" && pendientes.some((p) => p.campo === campo)) {
      return json({ error: "Ya tienes una sugerencia pendiente para este dato. Cancélala si quieres enviar otra." }, 409);
    }

    const solicitud = await SolicitudExpediente.create({
      paciente: session.userId,
      expediente: expediente._id,
      campo,
      valorAnterior: valorAnterior || undefined,
      valorPropuesto,
      comentario: comentario || undefined,
    });
    notificarSugerencia(solicitud, "nueva", { origen: new URL(request.url).origin });
    return json(solicitud, 201);
  } catch (error) {
    console.error("POST sugerencia expediente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};

// DELETE /api/paciente/expediente?solicitud=id - Cancelar una sugerencia pendiente
export const DELETE: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "paciente") return json({ error: "No autorizado" }, 403);

    const id = url.searchParams.get("solicitud");
    if (!esIdValido(id)) return json({ error: "Sugerencia inválida" }, 400);

    await connectDB();
    const borrada = await SolicitudExpediente.findOneAndDelete({ _id: id, paciente: session.userId, estado: "pendiente" });
    if (!borrada) return json({ error: "La sugerencia ya fue revisada o no existe" }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("DELETE sugerencia expediente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
