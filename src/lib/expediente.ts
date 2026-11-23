// Campos del expediente clínico compartidos por el médico (captura) y el
// paciente (sugerencias de modificación).

export const CAMPOS_EXPEDIENTE = {
  diagnostico: "Diagnóstico",
  motivoConsulta: "Motivo de consulta",
  antecedentes: "Antecedentes",
  alergias: "Alergias",
  medicamentos: "Medicamentos actuales",
  presionArterial: "Presión arterial",
  altura: "Altura (cm)",
  peso: "Peso (kg)",
} as const;

export type CampoExpediente = keyof typeof CAMPOS_EXPEDIENTE;
export const CAMPOS = Object.keys(CAMPOS_EXPEDIENTE) as CampoExpediente[];

// "otro" = comentario general; al aprobarse se integra como nota de evolución
export const CAMPOS_SUGERIBLES = [...CAMPOS, "otro"] as const;
export type CampoSugerible = (typeof CAMPOS_SUGERIBLES)[number];

export const ETIQUETA_CAMPO: Record<CampoSugerible, string> = {
  ...CAMPOS_EXPEDIENTE,
  otro: "Comentario general",
};

export const CAMPOS_REQUERIDOS: CampoExpediente[] = ["diagnostico", "motivoConsulta"];
export const esNumerico = (c: string) => c === "altura" || c === "peso";

/**
 * Normaliza el valor de un campo: número positivo para altura/peso, texto
 * recortado para el resto. `undefined` significa "vacío" (se quita del expediente).
 */
export function valorCampo(campo: CampoExpediente, v: unknown): string | number | undefined {
  if (esNumerico(campo)) {
    const n = Number(v);
    return v === "" || v === null || v === undefined || !Number.isFinite(n) || n <= 0 ? undefined : n;
  }
  return String(v ?? "").trim() || undefined;
}

/** Valor de un campo del expediente como texto ("" si no tiene). */
export const textoCampo = (exp: any, campo: string) => (exp?.[campo] == null ? "" : String(exp[campo]));
