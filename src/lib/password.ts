// Regla única de contraseñas. La usan el servidor (registro, restablecer,
// cambiar contraseña) y los formularios del navegador, para que siempre
// coincidan. No importar aquí nada de Node: este archivo también se empaqueta
// para el cliente.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Requisitos que se muestran al usuario (en el mismo orden que se validan)
export const REQUISITOS_PASSWORD = [
  { id: "len", texto: `Al menos ${PASSWORD_MIN} caracteres`, cumple: (p: string) => p.length >= PASSWORD_MIN },
  { id: "case", texto: "Una letra mayúscula y una minúscula", cumple: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { id: "num", texto: "Al menos un número", cumple: (p: string) => /\d/.test(p) },
] as const;

const COMUNES = [/^123456/, /^password/i, /^contrase(n|ñ)a/i, /^qwerty/i, /^abc123/i, /^111111/, /^admin/i];

/** Devuelve el mensaje de error o null si la contraseña es válida. */
export function errorPassword(password: unknown): string | null {
  const p = typeof password === "string" ? password : "";
  if (!p) return "La contraseña es obligatoria";
  if (p.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (p.length > PASSWORD_MAX) return "La contraseña es demasiado larga";
  if (!REQUISITOS_PASSWORD[1].cumple(p)) return "Incluye una letra mayúscula y una minúscula";
  if (!REQUISITOS_PASSWORD[2].cumple(p)) return "Incluye al menos un número";
  if (COMUNES.some((re) => re.test(p))) return "Esta contraseña es muy común";
  return null;
}
