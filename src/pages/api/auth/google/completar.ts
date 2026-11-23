import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { User } from "../../../../models/User";
import { getCookie, verifyShortToken, json } from "../../../../lib/session";
import { iniciarSesion } from "../../../../lib/auth";
import { cookieCorta, GOOGLE_SIGNUP_COOKIE, type GoogleProfile } from "../../../../lib/google";
import { datosProfesionales } from "../../../../lib/verificacion";
import { notificarMedicoPorVerificar } from "../../../../lib/notificaciones";

// POST /api/auth/google/completar → crea la cuenta de un usuario nuevo de Google con el rol elegido
export const POST: APIRoute = async ({ request }) => {
  try {
    const perfil = verifyShortToken<GoogleProfile>(getCookie(request, GOOGLE_SIGNUP_COOKIE));
    if (!perfil) {
      return json({ error: "El registro con Google expiró. Vuelve a intentarlo." }, 401);
    }

    const { role, nombre, apellido, telefono, cedulaProfesional, especialidad } = await request.json();
    if (!["medico", "paciente"].includes(role)) return json({ error: "Elige un tipo de cuenta" }, 400);
    if (!String(nombre ?? "").trim() || !String(apellido ?? "").trim()) {
      return json({ error: "Nombre y apellido son requeridos" }, 400);
    }

    // Médicos: cédula y especialidad obligatorias; la cuenta queda pendiente de verificación
    const profesional = role === "medico" ? datosProfesionales({ cedulaProfesional, especialidad }) : null;
    if (profesional && "error" in profesional) return json({ error: profesional.error }, 400);

    await connectDB();
    if (await User.exists({ $or: [{ email: perfil.email }, { googleId: perfil.googleId }] })) {
      return json({ error: "Esta cuenta de Google ya está registrada. Inicia sesión." }, 409);
    }

    const user = await User.create({
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      email: perfil.email,
      googleId: perfil.googleId,
      role,
      telefono: telefono || undefined,
      ...(profesional && { ...profesional, estadoVerificacion: "pendiente" }),
    });
    if (profesional) notificarMedicoPorVerificar(user._id, { origen: new URL(request.url).origin });

    const { cookie, redirect } = await iniciarSesion(user);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", cookie);
    headers.append("Set-Cookie", cookieCorta(GOOGLE_SIGNUP_COOKIE, "", 0));
    return new Response(JSON.stringify({ success: true, redirect }), { status: 201, headers });
  } catch (error) {
    console.error("Google completar error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
