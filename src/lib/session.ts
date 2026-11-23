import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET_DEV = "motionhub-secret-key-change-in-production";
const JWT_SECRET = (import.meta.env.JWT_SECRET || process.env.JWT_SECRET || "").trim() || SECRET_DEV;

// En producción la app no arranca con el secreto por defecto (o uno demasiado corto):
// cualquiera podría firmar sesiones válidas.
if (import.meta.env.PROD && (JWT_SECRET === SECRET_DEV || JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET no está definido (o tiene menos de 32 caracteres). Defínelo en .env antes de iniciar en producción.");
}

// ── Duración de las sesiones ────────────────────────────────────────────────
// Médico: la sesión se cierra tras MEDICO_INACTIVIDAD_MIN minutos sin actividad.
// Cada petición del médico renueva la cookie y la fecha de expiración en la DB
// (ventana deslizante). El JWT tiene un tope absoluto de 12 h. "Recordarme" no
// aplica a médicos: manejan expedientes y la sesión debe cerrarse sola.
// Administradores: misma política que los médicos (ver sesionEstricta).
// Paciente: con "Recordarme" la sesión dura 30 días; sin él, la cookie se borra
// al cerrar el navegador (y el JWT vence a las 12 h).
export const MEDICO_INACTIVIDAD_MIN = 10;
const MEDICO_JWT_EXPIRES = "12h";
const PACIENTE_EXPIRES_S = 12 * 3600;
const PACIENTE_RECORDAR_S = 30 * 24 * 3600;

export const SESSION_COOKIE = "mh_session";

export type Rol = "medico" | "paciente" | "admin";

/** Médicos y administradores: sesión única, cierre por inactividad y sin "Recordarme". */
export const sesionEstricta = (role: Rol) => role !== "paciente";

export interface JWTPayload {
  userId: string;
  email: string;
  role: Rol;
  nombre: string;
  sessionId: string; // ID único de sesión para single-session en médicos
  recordar?: boolean; // "Recordarme" (solo pacientes)
  iat?: number; // emisión del JWT (segundos), lo añade jsonwebtoken
}

export function signToken(payload: Omit<JWTPayload, "sessionId"> & { sessionId?: string }): string {
  const sessionId = payload.sessionId ?? crypto.randomUUID();
  const recordar = payload.role === "paciente" && !!payload.recordar;
  const expiresIn = sesionEstricta(payload.role) ? MEDICO_JWT_EXPIRES : recordar ? PACIENTE_RECORDAR_S : PACIENTE_EXPIRES_S;
  return jwt.sign({ ...payload, sessionId, recordar }, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/** Firma un token corto genérico (p. ej. el estado de OAuth o un registro pendiente). */
export function signShortToken(data: object, expiresIn: number): string {
  return jwt.sign(data, JWT_SECRET, { expiresIn });
}

export function verifyShortToken<T>(token: string | null | undefined): T | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch {
    return null;
  }
}

export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function getTokenFromRequest(request: Request): string | null {
  return getCookie(request, SESSION_COOKIE);
}

export function getSessionFromRequest(request: Request): JWTPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

/** Expiración (en la DB) de la sesión activa de un médico o administrador a partir de ahora. */
export function medicoSessionExpiry(): Date {
  return new Date(Date.now() + MEDICO_INACTIVIDAD_MIN * 60 * 1000);
}

// "Secure" solo en producción: en desarrollo se usa http://localhost
const SECURE = import.meta.env.PROD ? "; Secure" : "";

export function createSessionCookie(token: string, role: Rol, recordar = false): string {
  // Sin Max-Age la cookie es de sesión: el navegador la borra al cerrarse
  const maxAge =
    sesionEstricta(role) ? `; Max-Age=${MEDICO_INACTIVIDAD_MIN * 60}`
    : recordar ? `; Max-Age=${PACIENTE_RECORDAR_S}`
    : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${SECURE}${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${SECURE}; Max-Age=0`;
}

/** Huella SHA-256 de un token. En la DB se guarda la huella, nunca el token del enlace. */
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Token aleatorio para enlaces de un solo uso (recuperar contraseña, confirmar correo). */
export const tokenAleatorio = () => crypto.randomBytes(32).toString("hex");

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
