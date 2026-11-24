import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest, json, signToken, createSessionCookie, hashToken, tokenAleatorio } from "../../../lib/session";
import {
  enviarConfirmacionCorreo,
  enviarAvisoCambioCorreo,
  enviarEnSegundoPlano,
  siteUrl,
  CAMBIO_CORREO_EXPIRA_H,
} from "../../../lib/email";
import { LIMITES, consumir, demasiadosIntentos } from "../../../lib/rateLimit";
import { datosProfesionales } from "../../../lib/verificacion";
import { notificarMedicoPorVerificar } from "../../../lib/notificaciones";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PUT /api/perfil - Actualiza los datos personales (y profesionales si es médico)
export const PUT: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return json({ error: "No autenticado" }, 401);

    const body = await request.json();
    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return json({ error: "Usuario no encontrado" }, 404);

    // Cancelar un cambio de correo pendiente de confirmar
    if (body.cancelarCambioCorreo === true) {
      user.pendingEmail = user.pendingEmailToken = user.pendingEmailExpires = undefined;
      await user.save();
      return json({ success: true });
    }

    let correoPendiente: string | undefined;
    let enlaceCorreo = "";
    if (body.nombre !== undefined) {
      const v = String(body.nombre).trim();
      if (!v) return json({ error: "El nombre es requerido" }, 400);
      user.nombre = v;
    }
    if (body.apellido !== undefined) {
      const v = String(body.apellido).trim();
      if (!v) return json({ error: "El apellido es requerido" }, 400);
      user.apellido = v;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ error: "Correo electrónico inválido" }, 400);
      if (email !== user.email) {
        if (user.googleId) {
          return json({ error: "Tu correo está vinculado a Google y no se puede cambiar aquí." }, 400);
        }
        if (await User.exists({ email, _id: { $ne: user._id } })) {
          return json({ error: "Ese correo ya está registrado en otra cuenta" }, 409);
        }
        // El correo no cambia hasta que se confirme desde la nueva dirección
        if (email !== user.pendingEmail || !user.pendingEmailExpires || user.pendingEmailExpires < new Date()) {
          const espera = consumir(`correo-perfil:${user._id}`, LIMITES.correoPerfil);
          if (espera) return demasiadosIntentos(espera);
        }
        const token = tokenAleatorio();
        user.pendingEmail = email;
        user.pendingEmailToken = hashToken(token);
        user.pendingEmailExpires = new Date(Date.now() + CAMBIO_CORREO_EXPIRA_H * 3600_000);
        correoPendiente = email;
        enlaceCorreo = `${siteUrl(new URL(request.url).origin)}/api/auth/confirmar-correo?token=${token}`;
      }
    }
    if (body.telefono !== undefined) {
      const tel = String(body.telefono).trim();
      if (tel && !/^[+\d\s()-]{7,20}$/.test(tel)) return json({ error: "Teléfono inválido" }, 400);
      user.telefono = tel || undefined;
    }
    // Pacientes: recibir o no el recordatorio diario por correo
    if (typeof body.recordatoriosCorreo === "boolean" && user.role === "paciente") {
      user.recordatoriosCorreo = body.recordatoriosCorreo;
    }
    if (body.fechaNacimiento !== undefined) {
      if (!body.fechaNacimiento) {
        user.fechaNacimiento = undefined;
      } else {
        const f = new Date(body.fechaNacimiento);
        if (isNaN(f.getTime()) || f > new Date()) return json({ error: "Fecha de nacimiento inválida" }, 400);
        user.fechaNacimiento = f;
      }
    }
    // Médicos: cambiar la cédula (o cualquier dato profesional si fue rechazado)
    // devuelve la cuenta a revisión hasta que un administrador la verifique de nuevo
    let volvioARevision = false;
    if (user.role === "medico" && (body.especialidad !== undefined || body.cedulaProfesional !== undefined)) {
      const profesional = datosProfesionales({
        cedulaProfesional: body.cedulaProfesional ?? user.cedulaProfesional,
        especialidad: body.especialidad ?? user.especialidad,
      });
      if ("error" in profesional) return json({ error: profesional.error }, 400);
      const cambioCedula = profesional.cedulaProfesional !== user.cedulaProfesional;
      const cambioAlgo = cambioCedula || profesional.especialidad !== user.especialidad;
      user.cedulaProfesional = profesional.cedulaProfesional;
      user.especialidad = profesional.especialidad;
      if (cambioCedula || (cambioAlgo && user.estadoVerificacion !== "aprobada")) {
        volvioARevision = user.estadoVerificacion !== "pendiente";
        user.estadoVerificacion = "pendiente";
        user.motivoVerificacion = user.verificadoPor = user.verificadoEn = undefined;
      }
    }

    await user.save();
    if (volvioARevision) notificarMedicoPorVerificar(user._id, { origen: new URL(request.url).origin, reenvio: true });

    if (correoPendiente) {
      enviarEnSegundoPlano(enviarConfirmacionCorreo(correoPendiente, user.nombre, enlaceCorreo), "confirmar correo");
      enviarEnSegundoPlano(enviarAvisoCambioCorreo(user.email, user.nombre, correoPendiente), "aviso cambio de correo");
    }

    // El nombre viaja en el JWT: se reemite conservando el sessionId
    const token = signToken({
      userId: session.userId,
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      sessionId: session.sessionId,
      recordar: session.recordar,
    });

    return json({ success: true, correoPendiente, enRevision: volvioARevision }, 200, {
      "Set-Cookie": createSessionCookie(token, user.role, session.recordar),
    });
  } catch (error) {
    console.error("PUT perfil error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
