import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { json } from "../../../lib/session";
import { iniciarSesion, tieneSesionActiva } from "../../../lib/auth";
import { errorPassword } from "../../../lib/password";
import { LIMITES, bloqueado, consumir, registrar, limpiar, demasiadosIntentos, ipCliente } from "../../../lib/rateLimit";

export const POST: APIRoute = async (context) => {
  try {
    const { email, password, recordar } = await context.request.json().catch(() => ({}));
    if (!email || !password) {
      return json({ error: "Email y contraseña son requeridos" }, 400);
    }
    const correo = String(email).trim().toLowerCase();
    const claveCorreo = `login:correo:${correo}`;

    // Por IP se cuentan todos los intentos; por correo, solo los fallidos
    const espera =
      consumir(`login:ip:${ipCliente(context)}`, LIMITES.loginIp) ||
      bloqueado(claveCorreo, LIMITES.loginCorreo);
    if (espera) return demasiadosIntentos(espera);

    await connectDB();
    const user = await User.findOne({ email: correo });
    if (!user) {
      registrar(claveCorreo, LIMITES.loginCorreo);
      return json({ error: "Credenciales incorrectas" }, 401);
    }

    if (!user.password) {
      return json(
        { error: "Esta cuenta se creó con Google. Usa el botón «Google» para entrar." },
        401,
      );
    }

    if (!(await user.comparePassword(password))) {
      registrar(claveCorreo, LIMITES.loginCorreo);
      return json({ error: "Credenciales incorrectas" }, 401);
    }
    limpiar(claveCorreo);

    // Médicos: si hay otra sesión abierta (y no expirada) se pide confirmación
    // para cerrarla. Las sesiones expiradas ya no bloquean el acceso.
    if (tieneSesionActiva(user)) {
      return json(
        {
          error: "Ya tienes una sesión activa en otro dispositivo o navegador.",
          codigo: "SESION_ACTIVA",
        },
        409,
      );
    }

    const { cookie, redirect } = await iniciarSesion(user, { recordar: recordar === true });

    // Cuentas antiguas con una contraseña que ya no cumple la regla actual:
    // entran, pero se les lleva al perfil para que la cambien.
    const destino = errorPassword(password) ? `${redirect}/perfil?cambiar-password=1` : redirect;

    return json({ success: true, redirect: destino }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    console.error("Login error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
