import type { APIRoute } from "astro";
import crypto from "crypto";
import { googleAuthUrl, googleConfigurado, cookieCorta, GOOGLE_STATE_COOKIE } from "../../../../lib/google";

// GET /api/auth/google → redirige a la pantalla de Google
export const GET: APIRoute = async ({ url, redirect }) => {
  if (!googleConfigurado()) return redirect("/login?razon=google_no_configurado");

  const state = crypto.randomBytes(16).toString("hex");
  const res = redirect(googleAuthUrl(url, state));
  res.headers.append("Set-Cookie", cookieCorta(GOOGLE_STATE_COOKIE, state, 600));
  return res;
};
