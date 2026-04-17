import { defineMiddleware } from "astro:middleware";
import { getSessionFromRequest } from "../lib/session";
import connectDB from "../lib/db";
import { User } from "../models/User";

const MEDICO_ROUTES   = ["/dashboard/medico"];
const PACIENTE_ROUTES = ["/dashboard/paciente"];
const AUTH_ROUTES     = ["/login", "/register", "/reset-password", "/nueva-contrasena"];
const PROTECTED_ROUTES = [...MEDICO_ROUTES, ...PACIENTE_ROUTES];

// Headers que impiden al navegador cachear páginas protegidas.
// Esto bloquea que el botón "atrás" muestre la página tras cerrar sesión.
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma":        "no-cache",
  "Expires":       "0",
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  const isMedicoRoute   = MEDICO_ROUTES.some((r)   => pathname.startsWith(r));
  const isPacienteRoute = PACIENTE_ROUTES.some((r) => pathname.startsWith(r));
  const isProtected     = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute     = AUTH_ROUTES.some((r)     => pathname.startsWith(r));

  // ── Rutas no protegidas: pasa directo ───────────────────────────────────
  if (!isProtected && !isAuthRoute) return next();

  const session = getSessionFromRequest(context.request);

  // ── Si ya tiene sesión e intenta ir a login/register → dashboard ─────────
  if (isAuthRoute && session) {
    return context.redirect(
      session.role === "medico" ? "/dashboard/medico" : "/dashboard/paciente"
    );
  }

  // ── Sin sesión → login ───────────────────────────────────────────────────
  if (isProtected && !session) {
    return context.redirect("/login");
  }

  // ── Rol incorrecto ────────────────────────────────────────────────────────
  if (isMedicoRoute   && session?.role !== "medico")   return context.redirect("/dashboard/paciente");
  if (isPacienteRoute && session?.role !== "paciente") return context.redirect("/dashboard/medico");

  // ── Validación de sesión única para médicos ──────────────────────────────
  // Compara el sessionId del JWT con el guardado en la DB.
  // Si difieren, significa que el médico inició sesión en otro dispositivo/navegador.
  if (session?.role === "medico" && session.sessionId) {
    try {
      await connectDB();
      const userInDB = await User.findById(session.userId).select("activeSessionToken").lean();
      if (!userInDB || userInDB.activeSessionToken !== session.sessionId) {
        // Sesión invalidada: otro login ocurrió → redirige a login con mensaje
        const response = context.redirect("/login?razon=sesion_duplicada");
        // También limpiamos la cookie
        response.headers.append("Set-Cookie", "mh_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        return response;
      }
    } catch {
      // Si falla la DB, permitimos continuar para no bloquear por error de infraestructura
    }
  }

  // ── Añadir headers anti-cache a todas las páginas protegidas ─────────────
  // Esto hace que el botón "atrás" del navegador vuelva a verificar la sesión
  // en lugar de mostrar la versión cacheada.
  context.locals.session = session;
  const response = await next();

  Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
});