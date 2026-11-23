import crypto from "crypto";
import { User, type IUser } from "../models/User";
import { signToken, createSessionCookie, medicoSessionExpiry, hashToken, sesionEstricta, type Rol } from "./session";

export const dashboardDe = (role: Rol) => `/dashboard/${role}`;

/** ¿El médico (o administrador) tiene una sesión abierta (y no expirada) en otro navegador? */
export function tieneSesionActiva(user: IUser): boolean {
  return (
    sesionEstricta(user.role) &&
    !!user.activeSessionToken &&
    !!user.activeSessionExpires &&
    user.activeSessionExpires.getTime() > Date.now()
  );
}

/**
 * Crea una sesión nueva para el usuario. En médicos y administradores registra el sessionId en la
 * DB, lo que invalida cualquier sesión anterior en otro navegador.
 * Devuelve la cabecera Set-Cookie y la ruta del dashboard.
 */
export async function iniciarSesion(
  user: IUser,
  { recordar = false }: { recordar?: boolean } = {},
): Promise<{ cookie: string; redirect: string }> {
  const sessionId = crypto.randomUUID();
  recordar = recordar && user.role === "paciente";

  if (sesionEstricta(user.role)) {
    await User.updateOne(
      { _id: user._id },
      { activeSessionToken: sessionId, activeSessionExpires: medicoSessionExpiry() },
    );
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    nombre: user.nombre,
    sessionId,
    recordar,
  });

  return { cookie: createSessionCookie(token, user.role, recordar), redirect: dashboardDe(user.role) };
}

/**
 * Cierra todas las sesiones abiertas del usuario (tras restablecer o cambiar la
 * contraseña). Los JWT emitidos antes de `sesionesDesde` dejan de valer.
 * No guarda el documento: el llamador hace `save()`.
 */
export function revocarSesiones(user: IUser) {
  user.sesionesDesde = new Date();
  user.activeSessionToken = null;
  user.activeSessionExpires = null;
}

/** ¿El JWT se emitió antes de la última revocación de sesiones? (`iat` va en segundos) */
export const sesionRevocada = (iat: number | undefined, sesionesDesde?: Date | null) =>
  !!sesionesDesde && ((iat ?? 0) + 1) * 1000 <= sesionesDesde.getTime();

export { errorPassword } from "./password";

/** Usuario dueño de un token de recuperación de contraseña vigente (o null). */
export async function usuarioPorTokenReset(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  return User.findOne({ resetPasswordToken: hashToken(token), resetPasswordExpires: { $gt: new Date() } });
}
