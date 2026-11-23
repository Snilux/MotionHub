import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest, json } from "../../../lib/session";
import { errorPassword } from "../../../lib/password";
import { iniciarSesion, revocarSesiones } from "../../../lib/auth";
import { enviarAvisoPasswordCambiada, enviarEnSegundoPlano, siteUrl } from "../../../lib/email";

export const PUT: APIRoute = async ({ request }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return json({ error: "No autenticado" }, 401);

    const { actual = "", nueva = "", confirmar = "" } = await request.json();
    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) return json({ error: "Usuario no encontrado" }, 404);

    // Las cuentas creadas con Google pueden definir su primera contraseña sin la actual
    if (user.password && !(await user.comparePassword(String(actual)))) {
      return json({ error: "La contraseña actual no es correcta", campo: "passActual" }, 400);
    }
    const error = errorPassword(String(nueva));
    if (error) return json({ error, campo: "passNueva" }, 400);
    if (nueva !== confirmar) return json({ error: "Las contraseñas no coinciden", campo: "passConfirmar" }, 400);
    if (user.password && (await user.comparePassword(String(nueva)))) {
      return json({ error: "La nueva contraseña debe ser distinta a la actual", campo: "passNueva" }, 400);
    }

    const teniaPassword = !!user.password;
    user.password = String(nueva);
    // Se cierran las sesiones de otros dispositivos y se abre una nueva aquí
    revocarSesiones(user);
    await user.save();
    const { cookie } = await iniciarSesion(user, { recordar: session.recordar });

    if (teniaPassword) {
      enviarEnSegundoPlano(
        enviarAvisoPasswordCambiada(user.email, user.nombre, `${siteUrl(new URL(request.url).origin)}/login`),
        "contraseña cambiada",
      );
    }
    return json({ success: true }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    console.error("PUT password error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
