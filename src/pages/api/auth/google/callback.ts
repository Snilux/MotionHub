import type { APIRoute } from "astro";
import connectDB from "../../../../lib/db";
import { User } from "../../../../models/User";
import { getCookie, signShortToken } from "../../../../lib/session";
import { iniciarSesion, tieneSesionActiva } from "../../../../lib/auth";
import {
  obtenerPerfilGoogle,
  cookieCorta,
  GOOGLE_STATE_COOKIE,
  GOOGLE_SIGNUP_COOKIE,
  GOOGLE_FORCE_COOKIE,
} from "../../../../lib/google";

// GET /api/auth/google/callback → Google vuelve aquí con ?code=...&state=...
export const GET: APIRoute = async ({ url, request, redirect }) => {
  const fallo = (razon: string) => {
    const res = redirect(`/login?razon=${razon}`);
    res.headers.append("Set-Cookie", cookieCorta(GOOGLE_STATE_COOKIE, "", 0));
    return res;
  };

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return fallo("google_cancelado");
  if (!code || !state || state !== getCookie(request, GOOGLE_STATE_COOKIE)) return fallo("google_error");

  try {
    const perfil = await obtenerPerfilGoogle(url, code);
    await connectDB();

    let user = await User.findOne({ $or: [{ googleId: perfil.googleId }, { email: perfil.email }] });

    // Usuario nuevo → elegir rol en /completar-registro
    if (!user) {
      const res = redirect("/completar-registro");
      res.headers.append("Set-Cookie", cookieCorta(GOOGLE_STATE_COOKIE, "", 0));
      res.headers.append("Set-Cookie", cookieCorta(GOOGLE_SIGNUP_COOKIE, signShortToken(perfil, 900), 900));
      return res;
    }

    // Cuenta existente con el mismo correo → vincular Google
    if (!user.googleId) {
      user.googleId = perfil.googleId;
      await user.save();
    }

    // Médico con sesión abierta en otro navegador → pedir confirmación en /login
    if (tieneSesionActiva(user)) {
      const res = redirect("/login?razon=sesion_activa_google");
      res.headers.append("Set-Cookie", cookieCorta(GOOGLE_STATE_COOKIE, "", 0));
      res.headers.append(
        "Set-Cookie",
        cookieCorta(GOOGLE_FORCE_COOKIE, signShortToken({ userId: user._id.toString() }, 300), 300),
      );
      return res;
    }

    const { cookie, redirect: destino } = await iniciarSesion(user);
    const res = redirect(destino);
    res.headers.append("Set-Cookie", cookieCorta(GOOGLE_STATE_COOKIE, "", 0));
    res.headers.append("Set-Cookie", cookie);
    return res;
  } catch (error) {
    console.error("Google callback error:", error);
    return fallo("google_error");
  }
};
