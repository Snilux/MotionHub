import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { json } from "../../../lib/session";
import { errorPassword } from "../../../lib/password";
import { revocarSesiones, usuarioPorTokenReset } from "../../../lib/auth";
import { enviarAvisoPasswordCambiada, enviarEnSegundoPlano, siteUrl } from "../../../lib/email";
import { LIMITES, consumir, demasiadosIntentos, ipCliente } from "../../../lib/rateLimit";

// POST /api/auth/reset-password - Guarda la nueva contraseña con el token del correo
export const POST: APIRoute = async (context) => {
  try {
    const espera = consumir(`restablecer:ip:${ipCliente(context)}`, LIMITES.restablecerIp);
    if (espera) return demasiadosIntentos(espera);

    const { token, password } = await context.request.json().catch(() => ({}));
    if (!token || !password) return json({ error: "Token y contraseña son requeridos" }, 400);

    const errorPass = errorPassword(password);
    if (errorPass) return json({ error: errorPass }, 400);

    await connectDB();
    const user = await usuarioPorTokenReset(token);
    if (!user) {
      return json({ error: "El enlace es inválido o ya expiró. Solicita uno nuevo.", codigo: "TOKEN_INVALIDO" }, 400);
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Quien tuviera la contraseña anterior pierde el acceso
    revocarSesiones(user);
    await user.save();

    enviarEnSegundoPlano(
      enviarAvisoPasswordCambiada(user.email, user.nombre, `${siteUrl(new URL(context.request.url).origin)}/login`),
      "contraseña restablecida",
    );

    return json({ success: true, message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Reset password error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
