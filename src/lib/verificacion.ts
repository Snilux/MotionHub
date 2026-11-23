// Datos profesionales de los médicos y su verificación por un administrador.
// Un médico recién registrado queda "pendiente" y no puede atender pacientes
// (asignarlos, ver expedientes, etc.) hasta que un administrador lo apruebe.

export const ESTADOS_VERIFICACION = ["pendiente", "aprobada", "rechazada"] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];

// Cédula profesional mexicana: 7 u 8 dígitos
export const CEDULA_RE = /^\d{7,8}$/;

// Consulta pública de cédulas de la SEP, para que el administrador la verifique
export const URL_CONSULTA_CEDULA = "https://www.cedulaprofesional.sep.gob.mx/cedula/presidencia/indexAvanzada.action";

/** Normaliza y valida cédula y especialidad. Devuelve los datos limpios o un error. */
export function datosProfesionales(body: { cedulaProfesional?: unknown; especialidad?: unknown }) {
  const cedulaProfesional = String(body.cedulaProfesional ?? "").replace(/[\s-]/g, "");
  const especialidad = String(body.especialidad ?? "").trim().replace(/\s+/g, " ");
  if (!cedulaProfesional) return { error: "La cédula profesional es requerida" } as const;
  if (!CEDULA_RE.test(cedulaProfesional)) return { error: "La cédula profesional debe tener 7 u 8 dígitos" } as const;
  if (especialidad.length < 3) return { error: "Indica tu especialidad" } as const;
  if (especialidad.length > 100) return { error: "La especialidad es demasiado larga (máx. 100 caracteres)" } as const;
  return { cedulaProfesional, especialidad } as const;
}

/** ¿El médico puede atender pacientes? (las cuentas sin estado se consideran pendientes) */
export const medicoVerificado = (u: { role?: string; estadoVerificacion?: string | null } | null | undefined) =>
  u?.role === "medico" && u.estadoVerificacion === "aprobada";

/** Rutas que un médico sin verificar sí puede usar. */
export const RUTAS_MEDICO_SIN_VERIFICAR = ["/dashboard/medico/verificacion", "/dashboard/medico/perfil", "/api/medico/sesion"];
