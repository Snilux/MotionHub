// Inicio de sesión con Google (OAuth 2.0 / OpenID Connect, flujo "authorization code").
// Variables necesarias en .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y SITE_URL.

const env = (k: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];

export const GOOGLE_STATE_COOKIE  = "mh_g_state";
export const GOOGLE_SIGNUP_COOKIE = "mh_g_signup"; // datos de Google de un usuario nuevo (falta elegir rol)
export const GOOGLE_FORCE_COOKIE  = "mh_g_force";  // médico con sesión activa en otro navegador

export interface GoogleProfile {
  googleId: string;
  email: string;
  nombre: string;
  apellido: string;
}

export function googleConfigurado(): boolean {
  return !!env("GOOGLE_CLIENT_ID") && !!env("GOOGLE_CLIENT_SECRET");
}

export function siteUrl(requestUrl: URL): string {
  return (env("SITE_URL") || env("PUBLIC_SITE_URL") || requestUrl.origin).replace(/\/$/, "");
}

export function redirectUri(requestUrl: URL): string {
  return `${siteUrl(requestUrl)}/api/auth/google/callback`;
}

export function googleAuthUrl(requestUrl: URL, state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID")!,
    redirect_uri: redirectUri(requestUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Intercambia el código por un access token y obtiene el perfil verificado. */
export async function obtenerPerfilGoogle(requestUrl: URL, code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID")!,
      client_secret: env("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: redirectUri(requestUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error(`Google userinfo: ${infoRes.status}`);
  const info = await infoRes.json();

  if (!info.email || !info.email_verified) throw new Error("Correo de Google no verificado");

  return {
    googleId: String(info.sub),
    email: String(info.email).toLowerCase(),
    nombre: info.given_name || info.name || info.email.split("@")[0],
    apellido: info.family_name || "",
  };
}

export const cookieCorta = (nombre: string, valor: string, maxAge: number) =>
  `${nombre}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
