import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = import.meta.env.JWT_SECRET || "motionhub-secret-key-change-in-production";

// Médico expira en 10 minutos, paciente en 7 días
const MEDICO_EXPIRES   = "10m";
const PACIENTE_EXPIRES = "7d";

export interface JWTPayload {
  userId: string;
  email: string;
  role: "medico" | "paciente";
  nombre: string;
  sessionId: string; // ID único de sesión para single-session en médicos
}

export function signToken(payload: Omit<JWTPayload, "sessionId"> & { sessionId?: string }): string {
  const sessionId = payload.sessionId ?? crypto.randomUUID();
  const expiresIn = payload.role === "medico" ? MEDICO_EXPIRES : PACIENTE_EXPIRES;
  return jwt.sign({ ...payload, sessionId }, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): JWTPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return cookies["mh_session"] ?? null;
}

export function createSessionCookie(token: string, role: "medico" | "paciente"): string {
  // Médico: cookie de sesión expira en 10 min. Paciente: 7 días.
  const maxAge = role === "medico" ? 10 * 60 : 7 * 24 * 3600;
  return `mh_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `mh_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}