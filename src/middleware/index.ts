import { defineMiddleware } from "astro:middleware";
import {
  getSessionFromRequest,
  getTokenFromRequest,
  createSessionCookie,
  clearSessionCookie,
  medicoSessionExpiry,
  sesionEstricta,
  json,
  type Rol,
} from "../lib/session";
import connectDB from "../lib/db";
import { User } from "../models/User";
import { sesionRevocada, dashboardDe } from "../lib/auth";
import { medicoVerificado, RUTAS_MEDICO_SIN_VERIFICAR } from "../lib/verificacion";

// Zona horaria de la app: las fechas de citas se muestran en hora local de México.
process.env.TZ ||= "America/Mexico_City";

// Rutas exclusivas de cada rol
const RUTAS_ROL: Record<Rol, string[]> = {
  medico:   ["/dashboard/medico", "/api/medico"],
  paciente: ["/dashboard/paciente", "/api/paciente"],
  admin:    ["/dashboard/admin", "/api/admin"],
};
const COMMON_ROUTES   = ["/api/perfil", "/archivos/"]; // cualquier rol con sesión
const AUTH_ROUTES     = ["/login", "/register", "/reset-password", "/nueva-contrasena", "/completar-registro"];

// Headers que impiden al navegador cachear páginas protegidas.
// Esto bloquea que el botón "atrás" muestre la página tras cerrar sesión.
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma":        "no-cache",
  "Expires":       "0",
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  const rolDeRuta   = (Object.keys(RUTAS_ROL) as Rol[]).find((rol) => RUTAS_ROL[rol].some((r) => pathname.startsWith(r)));
  const isComun     = COMMON_ROUTES.some((r) => pathname.startsWith(r));
  const isProtected = !!rolDeRuta || isComun;
  const isApi       = pathname.startsWith("/api/");
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // ── Rutas no protegidas: pasa directo ───────────────────────────────────
  if (!isProtected && !isAuthRoute) return next();

  const session = getSessionFromRequest(context.request);
  context.locals.session = session;

  // Respuesta para accesos no válidos: JSON en APIs, redirección en páginas
  const denegar = (razon?: string, limpiarCookie = false) => {
    const res = isApi
      ? json({ error: "Sesión no válida", razon }, 401)
      : context.redirect(razon ? `/login?razon=${razon}` : "/login");
    if (limpiarCookie) res.headers.append("Set-Cookie", clearSessionCookie());
    return res;
  };

  // ── Si ya tiene sesión e intenta ir a login/register → dashboard ─────────
  if (isAuthRoute) {
    if (session) return context.redirect(dashboardDe(session.role));
    return next();
  }

  // ── Sin sesión → login ───────────────────────────────────────────────────
  if (!session) return denegar();

  // ── Rol incorrecto ────────────────────────────────────────────────────────
  if (rolDeRuta && session.role !== rolDeRuta) {
    return isApi ? json({ error: "No autorizado" }, 403) : context.redirect(dashboardDe(session.role));
  }

  let renovarCookie = false;
  if (!sesionEstricta(session.role)) {
    // Pacientes: solo se comprueba que la sesión no se haya revocado
    // (p. ej. al restablecer la contraseña)
    try {
      await connectDB();
      const user = await User.findById(session.userId).select("sesionesDesde").lean();
      if (!user || sesionRevocada(session.iat, user.sesionesDesde)) return denegar("expiracion", true);
    } catch (error) {
      console.error("Middleware sesión:", error);
    }
  } else {
    // ── Sesión única para médicos y administradores ─────────────────────────
    // Si el sessionId del JWT no coincide con el de la DB, se inició sesión
    // en otro navegador y esta sesión queda cerrada.
    let verificado = false;
    try {
      await connectDB();
      const user = await User.findById(session.userId)
        .select("role estadoVerificacion activeSessionToken activeSessionExpires sesionesDesde")
        .lean();

      if (!user) return denegar(undefined, true);
      if (sesionRevocada(session.iat, user.sesionesDesde)) return denegar("expiracion", true);

      if (user.activeSessionToken !== session.sessionId) {
        return denegar("sesion_duplicada", true);
      }
      verificado = medicoVerificado(user);

      // Renovar la ventana de inactividad (DB + cookie)
      await User.updateOne(
        { _id: session.userId, activeSessionToken: session.sessionId },
        { activeSessionExpires: medicoSessionExpiry() },
      );
      renovarCookie = true;
    } catch (error) {
      // Si falla la DB, permitimos continuar para no bloquear por error de infraestructura
      // (pero un médico no se da por verificado: se le limita como si estuviera pendiente)
      console.error("Middleware sesión:", error);
    }

    // ── Médico sin verificar: solo su página de verificación y su perfil ─────
    if (session.role === "medico") {
      context.locals.medicoVerificado = verificado;
      const permitida = RUTAS_MEDICO_SIN_VERIFICAR.some((r) => pathname.startsWith(r)) || isComun;
      if (!verificado && !permitida) {
        return isApi
          ? json({ error: "Tu cuenta está pendiente de verificación", codigo: "NO_VERIFICADO" }, 403)
          : context.redirect("/dashboard/medico/verificacion");
      }
    }
  }

  const response = await next();

  // (si la ruta ya emitió su propia cookie de sesión, se respeta esa)
  const yaTieneCookie = (response.headers.getSetCookie?.() ?? []).some((c) => c.startsWith("mh_session="));
  if (renovarCookie && !yaTieneCookie) {
    const token = getTokenFromRequest(context.request);
    if (token) response.headers.append("Set-Cookie", createSessionCookie(token, session.role));
  }

  // Headers anti-cache en todo lo protegido (los archivos subidos traen su propio
  // Cache-Control "private": su nombre cambia en cada subida)
  if (!pathname.startsWith("/archivos/")) {
    Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
});
