import { defineMiddleware } from "astro:middleware";
import { getSessionFromRequest } from "./lib/session";

// Rutas que requieren autenticación y rol específico
const MEDICO_ROUTES = ["/dashboard/medico"];
const PACIENTE_ROUTES = ["/dashboard/paciente"];
const AUTH_ROUTES = ["/login", "/register", "/reset-password", "/nueva-contrasena"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  const isMedicoRoute = MEDICO_ROUTES.some((r) => pathname.startsWith(r));
  const isPacienteRoute = PACIENTE_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Si no es una ruta protegida ni de auth, continúa
  if (!isMedicoRoute && !isPacienteRoute && !isAuthRoute) {
    return next();
  }

  const session = getSessionFromRequest(context.request);

  // Si intenta acceder a login/register pero ya tiene sesión, redirige al dashboard
  if (isAuthRoute && session) {
    const redirectUrl =
      session.role === "medico" ? "/dashboard/medico" : "/dashboard/paciente";
    return context.redirect(redirectUrl);
  }

  // Ruta de médico sin sesión o rol incorrecto
  if (isMedicoRoute) {
    if (!session) return context.redirect("/login");
    if (session.role !== "medico") return context.redirect("/dashboard/paciente");
  }

  // Ruta de paciente sin sesión o rol incorrecto
  if (isPacienteRoute) {
    if (!session) return context.redirect("/login");
    if (session.role !== "paciente") return context.redirect("/dashboard/medico");
  }

  // Pasar sesión a las páginas como local
  context.locals.session = session;

  return next();
});
