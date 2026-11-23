import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { json, getCookie, verifyShortToken, sesionEstricta } from "../../../lib/session";
import { iniciarSesion } from "../../../lib/auth";
import { errorPassword } from "../../../lib/password";
import { cookieCorta, GOOGLE_FORCE_COOKIE } from "../../../lib/google";
import { LIMITES, bloqueado, consumir, registrar, demasiadosIntentos, ipCliente } from "../../../lib/rateLimit";

// Cierra la sesión activa del médico (o administrador) en otro navegador e inicia una nueva aquí.
// Acepta credenciales (email + contraseña) o el comprobante de un login con Google.
export const POST: APIRoute = async (context) => {
  try {
    const { email, password, google } = await context.request.json().catch(() => ({}));
    let user = null;
    let passwordDebil = false;

    await connectDB();

    if (google) {
      const data = verifyShortToken<{ userId: string }>(getCookie(context.request, GOOGLE_FORCE_COOKIE));
      if (!data) return json({ error: "La verificación con Google expiró. Vuelve a intentarlo." }, 401);
      user = await User.findById(data.userId);
    } else {
      if (!email || !password) return json({ error: "Credenciales requeridas" }, 400);
      // Mismos límites que /api/auth/login
      const correo = String(email).trim().toLowerCase();
      const claveCorreo = `login:correo:${correo}`;
      const espera =
        consumir(`login:ip:${ipCliente(context)}`, LIMITES.loginIp) ||
        bloqueado(claveCorreo, LIMITES.loginCorreo);
      if (espera) return demasiadosIntentos(espera);

      user = await User.findOne({ email: correo });
      if (!user || !(await user.comparePassword(password))) {
        registrar(claveCorreo, LIMITES.loginCorreo);
        user = null;
      }
      passwordDebil = !!errorPassword(password);
    }

    if (!user || !sesionEstricta(user.role)) return json({ error: "Credenciales incorrectas" }, 401);

    // iniciarSesion sobrescribe el sessionId anterior → la otra sesión queda invalidada
    const { cookie, redirect } = await iniciarSesion(user);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", cookie);
    headers.append("Set-Cookie", cookieCorta(GOOGLE_FORCE_COOKIE, "", 0));
    const destino = passwordDebil ? `${redirect}/perfil?cambiar-password=1` : redirect;
    return new Response(JSON.stringify({ success: true, redirect: destino }), { status: 200, headers });
  } catch (error) {
    console.error("Forzar login error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
};
