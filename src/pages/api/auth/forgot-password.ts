import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { json, hashToken, tokenAleatorio } from "../../../lib/session";
import { sendPasswordResetEmail, siteUrl, RESET_EXPIRA_MIN } from "../../../lib/email";
import { LIMITES, consumir, demasiadosIntentos, ipCliente } from "../../../lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados
const MENSAJE = "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.";

// POST /api/auth/forgot-password - Envía el enlace para restablecer la contraseña
export const POST: APIRoute = async (context) => {
  try {
    const { email } = await context.request.json().catch(() => ({}));
    const correo = String(email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(correo)) return json({ error: "Escribe un correo electrónico válido" }, 400);

    const espera =
      consumir(`recuperar:ip:${ipCliente(context)}`, LIMITES.recuperarIp) ||
      consumir(`recuperar:correo:${correo}`, LIMITES.recuperarCorreo);
    if (espera) return demasiadosIntentos(espera);

    await connectDB();
    const user = await User.findOne({ email: correo });
    if (!user) return json({ message: MENSAJE });

    // En la DB solo se guarda la huella: si alguien lee la base no puede usar el enlace
    const token = tokenAleatorio();
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_EXPIRA_MIN * 60_000);
    await user.save();

    const resetUrl = `${siteUrl(new URL(context.request.url).origin)}/nueva-contrasena?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, user.nombre, resetUrl);
    } catch (error) {
      // No se revela al usuario si la cuenta existe; el error queda en el log
      console.error("Forgot password: no se pudo enviar el correo:", error);
    }

    return json({ message: MENSAJE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
