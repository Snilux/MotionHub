import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { Expediente } from "../../../../models/Expediente";
import { SolicitudExpediente } from "../../../../models/SolicitudExpediente";
import { getSessionFromRequest, json } from "../../../../lib/session";
import { esIdValido, esMiPaciente } from "../../../../lib/medico";
import { notificarSugerencia } from "../../../../lib/notificaciones";
import { CAMPOS_REQUERIDOS, ETIQUETA_CAMPO, esNumerico, valorCampo, type CampoExpediente } from "../../../../lib/expediente";

// PUT /api/medico/solicitud/:id - Revisar una sugerencia del paciente
// { accion: "aprobar", valor?, respuesta? } integra el valor (el propuesto o el ajustado por el médico)
// { accion: "rechazar", respuesta? } la descarta sin tocar el expediente
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Sugerencia inválida" }, 400);

    const body = await request.json().catch(() => ({}));
    const { accion } = body;
    if (accion !== "aprobar" && accion !== "rechazar") return json({ error: "Acción inválida" }, 400);
    const respuesta = String(body.respuesta ?? "").trim();
    if (respuesta.length > 500) return json({ error: "La respuesta es demasiado larga (máx. 500 caracteres)" }, 400);

    await connectDB();
    const solicitud = await SolicitudExpediente.findById(params.id);
    if (!solicitud || !(await esMiPaciente(session.userId, String(solicitud.paciente)))) {
      return json({ error: "Sugerencia no encontrada" }, 404);
    }
    if (solicitud.estado !== "pendiente") return json({ error: "Esta sugerencia ya fue revisada" }, 409);

    const revision = { respuesta: respuesta || undefined, revisadaPor: session.userId, revisadaEn: new Date() };

    if (accion === "rechazar") {
      const r = await SolicitudExpediente.findOneAndUpdate(
        { _id: solicitud._id, estado: "pendiente" },
        { estado: "rechazada", ...revision },
        { returnDocument: "after" },
      );
      if (!r) return json({ error: "Esta sugerencia ya fue revisada" }, 409);
      notificarSugerencia(r, "rechazada", { origen: new URL(request.url).origin });
      return json(r);
    }

    // Aprobar: valor final (el médico puede ajustarlo antes de integrarlo)
    const texto = String(body.valor ?? solicitud.valorPropuesto).trim();
    if (texto.length > 1000) return json({ error: "El valor es demasiado largo (máx. 1000 caracteres)" }, 400);

    const update: Record<string, any> = {};
    let nota: string;
    if (solicitud.campo === "otro") {
      if (!texto) return json({ error: "Escribe la nota que se integrará al expediente" }, 400);
      nota = `Comentario del paciente integrado: ${texto}`;
    } else {
      const campo = solicitud.campo as CampoExpediente;
      const valor = valorCampo(campo, texto);
      if (valor === undefined && CAMPOS_REQUERIDOS.includes(campo)) {
        return json({ error: `${ETIQUETA_CAMPO[campo]} no puede quedar vacío` }, 400);
      }
      if (valor === undefined && esNumerico(campo) && texto) return json({ error: "Escribe un número válido mayor a 0" }, 400);
      if (valor === undefined) update.$unset = { [campo]: 1 };
      else update.$set = { [campo]: valor };
      nota = `${ETIQUETA_CAMPO[campo]} actualizado a partir de una sugerencia del paciente: ${valor ?? "(sin dato)"}`;
    }
    // Queda constancia en las notas de evolución
    update.$push = { evolucion: { nota, medico: session.userId, fecha: new Date() } };

    // Se marca primero como aprobada para que dos revisiones simultáneas no la apliquen dos veces
    const aprobada = await SolicitudExpediente.findOneAndUpdate(
      { _id: solicitud._id, estado: "pendiente" },
      { estado: "aprobada", valorAplicado: texto, ...revision },
      { returnDocument: "after" },
    );
    if (!aprobada) return json({ error: "Esta sugerencia ya fue revisada" }, 409);

    const expediente = await Expediente.findOneAndUpdate({ _id: solicitud.expediente, paciente: solicitud.paciente }, update, { returnDocument: "after" });
    if (!expediente) {
      await SolicitudExpediente.updateOne({ _id: solicitud._id }, { estado: "pendiente", $unset: { valorAplicado: 1, respuesta: 1, revisadaPor: 1, revisadaEn: 1 } });
      return json({ error: "Expediente no encontrado" }, 404);
    }

    notificarSugerencia(aprobada, "aprobada", { origen: new URL(request.url).origin });
    return json(aprobada);
  } catch (error) {
    console.error("PUT solicitud expediente error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
