import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { getSessionFromRequest, hashToken, signToken, createSessionCookie } from "../../../lib/session";
import { dashboardDe } from "../../../lib/auth";

// GET /api/auth/confirmar-correo?token=... - Enlace del correo enviado al cambiar
// el correo desde el perfil. Aplica el cambio y vuelve al perfil (o al login).
export const GET: APIRoute = async ({ request, url }) => {
  const token = url.searchParams.get("token") ?? "";
  const session = getSessionFromRequest(request);
  const volver = (estado: string) =>
    session ? `${dashboardDe(session.role)}/perfil?correo=${estado}` : `/login?razon=correo_${estado}`;
  // Response propia (no Response.redirect) para poder añadir la cookie
  const redirect = (destino: string) => new Response(null, { status: 302, headers: { Location: destino } });

  try {
    if (!/^[a-f0-9]{64}$/.test(token)) return redirect(volver("invalido"));

    await connectDB();
    const user = await User.findOne({
      pendingEmailToken: hashToken(token),
      pendingEmailExpires: { $gt: new Date() },
    });
    if (!user || !user.pendingEmail) return redirect(volver("invalido"));

    // Alguien pudo registrarse con ese correo mientras estaba pendiente
    if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) {
      user.pendingEmail = user.pendingEmailToken = user.pendingEmailExpires = undefined;
      await user.save();
      return redirect(volver("ocupado"));
    }

    user.email = user.pendingEmail;
    user.pendingEmail = user.pendingEmailToken = user.pendingEmailExpires = undefined;
    await user.save();

    const res = redirect(volver("confirmado"));
    // Si la sesión abierta es de este usuario, se reemite con el correo nuevo
    if (session?.userId === String(user._id)) {
      const nuevo = signToken({
        userId: session.userId,
        email: user.email,
        role: user.role,
        nombre: user.nombre,
        sessionId: session.sessionId,
        recordar: session.recordar,
      });
      res.headers.append("Set-Cookie", createSessionCookie(nuevo, user.role, session.recordar));
    }
    return res;
  } catch (error) {
    console.error("Confirmar correo error:", error);
    return redirect(volver("invalido"));
  }
};
