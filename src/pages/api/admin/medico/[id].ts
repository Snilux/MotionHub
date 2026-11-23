import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { User } from "../../../../models/User";
import { getSessionFromRequest, json } from "../../../../lib/session";
import { esIdValido } from "../../../../lib/medico";
import { CEDULA_RE } from "../../../../lib/verificacion";
import { notificarVerificacion } from "../../../../lib/notificaciones";

// PUT /api/admin/medico/:id - Verificar la cuenta de un médico
// { accion: "aprobar" } activa la cuenta; { accion: "rechazar", motivo } la rechaza
// (o revoca una verificación anterior). El médico recibe un correo con el resultado.
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "admin") return json({ error: "No autorizado" }, 403);
    if (!esIdValido(params.id)) return json({ error: "Fisioterapeuta inválido" }, 400);

    const body = await request.json().catch(() => ({}));
    const { accion } = body;
    if (accion !== "aprobar" && accion !== "rechazar") return json({ error: "Acción inválida" }, 400);
    const motivo = String(body.motivo ?? "").trim();
    if (accion === "rechazar" && motivo.length < 5) return json({ error: "Explica el motivo para que el fisioterapeuta pueda corregirlo" }, 400);
    if (motivo.length > 500) return json({ error: "El motivo es demasiado largo (máx. 500 caracteres)" }, 400);

    await connectDB();
    const medico = await User.findOne({ _id: params.id, role: "medico" });
    if (!medico) return json({ error: "Fisioterapeuta no encontrado" }, 404);

    const aprobar = accion === "aprobar";
    if (aprobar && !CEDULA_RE.test(medico.cedulaProfesional ?? "")) {
      return json({ error: "No tiene una cédula válida registrada; no se puede aprobar" }, 400);
    }
    const nuevoEstado = aprobar ? "aprobada" : "rechazada";
    if (medico.estadoVerificacion === nuevoEstado) {
      return json({ error: aprobar ? "La cuenta ya está verificada" : "La cuenta ya está rechazada" }, 409);
    }

    medico.estadoVerificacion = nuevoEstado;
    medico.motivoVerificacion = aprobar ? undefined : motivo;
    medico.verificadoPor = session.userId as any;
    medico.verificadoEn = new Date();
    await medico.save();

    notificarVerificacion(medico, aprobar, medico.motivoVerificacion, { origen: new URL(request.url).origin });
    return json({ ok: true, estadoVerificacion: nuevoEstado });
  } catch (error) {
    console.error("PUT verificación médico error:", error);
    return json({ error: "Error interno" }, 500);
  }
};
