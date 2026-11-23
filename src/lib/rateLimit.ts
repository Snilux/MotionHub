import { json } from "./session";

// Límite de intentos en memoria (ventana fija por clave). Suficiente para un
// solo contenedor; si la app se escala a varias instancias habrá que moverlo a
// Redis o a MongoDB para que compartan el conteo.

interface Registro {
  intentos: number;
  reinicio: number; // timestamp (ms) en que se reinicia la ventana
}

const registros = new Map<string, Registro>();

// Limpieza periódica para que el mapa no crezca sin fin
setInterval(() => {
  const ahora = Date.now();
  for (const [k, r] of registros) if (r.reinicio <= ahora) registros.delete(k);
}, 60_000).unref?.();

export interface Limite {
  max: number;
  ventanaMs: number;
}

export const LIMITES = {
  loginIp:         { max: 30, ventanaMs: 15 * 60_000 }, // intentos de login por IP
  loginCorreo:     { max: 5,  ventanaMs: 15 * 60_000 }, // contraseñas incorrectas por correo
  recuperarIp:     { max: 5,  ventanaMs: 15 * 60_000 },
  recuperarCorreo: { max: 3,  ventanaMs: 60 * 60_000 },
  restablecerIp:   { max: 10, ventanaMs: 15 * 60_000 },
  registroIp:      { max: 10, ventanaMs: 60 * 60_000 },
  busquedaMedico:  { max: 60, ventanaMs: 60_000 },
  correoPerfil:    { max: 5,  ventanaMs: 60 * 60_000 }, // correos de confirmación al cambiar el correo
} satisfies Record<string, Limite>;

/** Segundos que faltan para poder reintentar, o 0 si aún quedan intentos. No suma. */
export function bloqueado(clave: string, { max }: Limite): number {
  const r = registros.get(clave);
  if (!r || r.reinicio <= Date.now()) return 0;
  return r.intentos >= max ? Math.ceil((r.reinicio - Date.now()) / 1000) : 0;
}

/** Suma un intento a la clave. */
export function registrar(clave: string, { ventanaMs }: Limite) {
  const ahora = Date.now();
  const r = registros.get(clave);
  if (!r || r.reinicio <= ahora) registros.set(clave, { intentos: 1, reinicio: ahora + ventanaMs });
  else r.intentos++;
}

/** Suma un intento y devuelve los segundos de espera si se pasó del límite (0 si no). */
export function consumir(clave: string, limite: Limite): number {
  const espera = bloqueado(clave, limite);
  if (espera) return espera;
  registrar(clave, limite);
  return 0;
}

export function limpiar(clave: string) {
  registros.delete(clave);
}

/** Respuesta 429 estándar. */
export function demasiadosIntentos(segundos: number): Response {
  const minutos = Math.ceil(segundos / 60);
  return json(
    {
      error: `Demasiados intentos. Vuelve a intentarlo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
      codigo: "DEMASIADOS_INTENTOS",
    },
    429,
    { "Retry-After": String(segundos) },
  );
}

// X-Forwarded-For lo puede falsificar cualquiera: solo se usa si la app está
// detrás de un proxy propio (nginx, Cloudflare) y se define TRUST_PROXY=true.
const CONFIAR_PROXY = (import.meta.env.TRUST_PROXY ?? process.env.TRUST_PROXY) === "true";

/** IP del cliente para el límite de intentos. */
export function ipCliente(context: { request: Request; clientAddress?: string }): string {
  if (CONFIAR_PROXY) {
    const reenviada = context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (reenviada) return reenviada;
  }
  try {
    return context.clientAddress || "desconocida";
  } catch {
    return "desconocida"; // el adaptador no expone la IP
  }
}
