// Frecuencia de una rutina y reglas para registrar sesiones.
//
// Una rutina se hace "N veces" por periodo (día, semana o mes). Opcionalmente el
// médico elige en qué días:
//   - diaria o semanal → días de la semana (0 = domingo … 6 = sábado)
//   - mensual          → días del mes (1–28, para que existan en todos los meses)
//
// Reglas al registrar una sesión:
//   1. Si hay días elegidos, solo se registra en esos días.
//   2. Como máximo N sesiones en el periodo (hoy / esta semana / este mes).
//   3. Una sola sesión por ventana: diaria → por hora; semanal → por día;
//      mensual → por semana (o por día si tiene días elegidos o más de 4 veces).
//
// Todo se calcula en la hora local de la app (TZ = America/Mexico_City).
// Este módulo no depende de la base de datos: lo usan la API, las páginas y los recordatorios.

export const PERIODOS = {
  dia: { label: "al día", corto: "Diario", este: "hoy" },
  semana: { label: "por semana", corto: "Semanal", este: "esta semana" },
  mes: { label: "al mes", corto: "Mensual", este: "este mes" },
} as const;
export type Periodo = keyof typeof PERIODOS;

// De lunes a domingo (getDay(): 0 = domingo)
export const DIAS_SEMANA = [
  { n: 1, letra: "L", corto: "lun", largo: "lunes" },
  { n: 2, letra: "M", corto: "mar", largo: "martes" },
  { n: 3, letra: "M", corto: "mié", largo: "miércoles" },
  { n: 4, letra: "J", corto: "jue", largo: "jueves" },
  { n: 5, letra: "V", corto: "vie", largo: "viernes" },
  { n: 6, letra: "S", corto: "sáb", largo: "sábado" },
  { n: 0, letra: "D", corto: "dom", largo: "domingo" },
] as const;
export const MAX_DIA_MES = 28;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const LARGO_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CORTO_DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export interface Frecuencia {
  frecuenciaVeces?: number | null;
  frecuenciaPeriodo?: Periodo | string | null;
  frecuenciaDias?: number[] | null;
}

interface FrecuenciaNormal {
  veces: number;
  periodo: Periodo;
  dias: number[]; // vacío = cualquier día
}

export function normalizar(f: Frecuencia): FrecuenciaNormal {
  const periodo = (f.frecuenciaPeriodo && f.frecuenciaPeriodo in PERIODOS ? f.frecuenciaPeriodo : "semana") as Periodo;
  const veces = Number.isInteger(f.frecuenciaVeces) && (f.frecuenciaVeces as number) > 0 ? (f.frecuenciaVeces as number) : 3;
  const dias = [...new Set((f.frecuenciaDias ?? []).map(Number))].sort((a, b) => a - b);
  return { veces, periodo, dias };
}

// ── Textos ──────────────────────────────────────────────────────────────────

const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

/** "lun, mié y vie" o "días 1, 15 y 28"; "" si no hay días elegidos. */
export function textoDias(f: Frecuencia): string {
  const { periodo, dias } = normalizar(f);
  if (!dias.length) return "";
  if (periodo === "mes") return `${dias.length === 1 ? "día" : "días"} ${lista(dias.map(String))}`;
  const orden = DIAS_SEMANA.filter((d) => dias.includes(d.n)).map((d) => d.corto);
  return lista(orden);
}

/** "los lunes, miércoles y viernes" o "los días 1 y 15 de cada mes" (para frases). */
export function cuandoToca(f: Frecuencia): string {
  const { periodo, dias } = normalizar(f);
  if (!dias.length) return "";
  if (periodo === "mes") return `los días ${lista(dias.map(String))} de cada mes`;
  const plural = (s: string) => (s.endsWith("s") ? s : `${s}s`);
  return `los ${lista(DIAS_SEMANA.filter((d) => dias.includes(d.n)).map((d) => plural(d.largo)))}`;
}

/** "3 veces por semana (lun, mié y vie)" */
export function textoFrecuencia(veces: number, periodo: Periodo, dias: number[] = []): string {
  const base = `${veces} ${veces === 1 ? "vez" : "veces"} ${PERIODOS[periodo].label}`;
  const d = textoDias({ frecuenciaVeces: veces, frecuenciaPeriodo: periodo, frecuenciaDias: dias });
  return d ? `${base} (${d})` : base;
}

// ── Validación (al crear o editar una rutina) ────────────────────────────────

export function validarFrecuencia(vecesIn: unknown, periodoIn: unknown, diasIn: unknown) {
  const veces = Number(vecesIn);
  const periodo = periodoIn as Periodo;
  if (!Number.isInteger(veces) || veces < 1 || veces > 31 || !(periodo in PERIODOS)) {
    return { error: "Elige una frecuencia válida" };
  }
  const crudos = diasIn === undefined || diasIn === null ? [] : diasIn;
  if (!Array.isArray(crudos)) return { error: "Días inválidos" };
  const dias = [...new Set(crudos.map(Number))].sort((a, b) => a - b);
  const [min, max] = periodo === "mes" ? [1, MAX_DIA_MES] : [0, 6];
  if (dias.some((d) => !Number.isInteger(d) || d < min || d > max)) return { error: "Días inválidos" };

  if (periodo === "semana" && veces > 7) return { error: "Una rutina semanal puede hacerse como máximo 7 veces por semana" };
  if (periodo === "dia" && veces > 12) return { error: "Una rutina diaria puede hacerse como máximo 12 veces al día" };
  if (dias.length && periodo !== "dia" && dias.length !== veces) {
    return { error: `Elige exactamente ${veces} ${veces === 1 ? "día" : "días"} (uno por cada sesión) o quita los días fijos` };
  }
  // Rutina diaria con los 7 días = cualquier día
  return { veces, periodo, dias: periodo === "dia" && dias.length === 7 ? [] : dias };
}

// ── Calendario ──────────────────────────────────────────────────────────────

const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const masDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours());
const inicioSemana = (d: Date) => masDias(inicioDia(d), -((d.getDay() + 6) % 7)); // lunes
const dos = (n: number) => String(n).padStart(2, "0");
const claveDia = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** ¿Le toca hacer la rutina en esta fecha? (sin días elegidos: siempre) */
export function tocaEnFecha(f: Frecuencia, fecha: Date): boolean {
  const { periodo, dias } = normalizar(f);
  if (!dias.length) return true;
  return dias.includes(periodo === "mes" ? fecha.getDate() : fecha.getDay());
}

/** Periodo en el que se cuentan las N sesiones (hoy / esta semana / este mes). */
export function periodoActual(f: Frecuencia, ahora = new Date()) {
  const { periodo } = normalizar(f);
  const hoy = inicioDia(ahora);
  if (periodo === "dia") return { inicio: hoy, fin: masDias(hoy, 1), este: PERIODOS.dia.este };
  if (periodo === "semana") {
    const lunes = inicioSemana(ahora);
    return { inicio: lunes, fin: masDias(lunes, 7), este: PERIODOS.semana.este };
  }
  const primero = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  return { inicio: primero, fin: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1), este: PERIODOS.mes.este };
}

/**
 * Ventana en la que solo cabe una sesión. `clave` + índice único (rutina, ventana)
 * en la base impiden duplicados aunque lleguen dos envíos a la vez.
 */
export function ventanaRegistro(f: Frecuencia, ahora = new Date()) {
  const { periodo, veces, dias } = normalizar(f);
  if (periodo === "dia") {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), ahora.getHours());
    return { clave: `h:${claveDia(inicio)}T${dos(inicio.getHours())}`, inicio, fin: new Date(inicio.getTime() + 3600_000), ya: "en esta hora" };
  }
  if (periodo === "semana" || dias.length || veces > 4) {
    const inicio = inicioDia(ahora);
    return { clave: `d:${claveDia(inicio)}`, inicio, fin: masDias(inicio, 1), ya: "hoy" };
  }
  const inicio = inicioSemana(ahora);
  return { clave: `w:${claveDia(inicio)}`, inicio, fin: masDias(inicio, 7), ya: "esta semana" };
}

/** Desde cuándo hay que leer sesiones para evaluar periodo y ventana. */
export function desdeParaEvaluar(f: Frecuencia, ahora = new Date()): Date {
  const a = periodoActual(f, ahora).inicio;
  const b = ventanaRegistro(f, ahora).inicio;
  return a < b ? a : b;
}

const enRango = (fechas: Date[], inicio: Date, fin: Date) => fechas.filter((d) => d >= inicio && d < fin).length;

/** Primer momento (desde `ahora`) en que se podría registrar otra sesión. */
export function proximaOportunidad(f: Frecuencia, fechas: Date[], ahora = new Date()): Date | null {
  const { veces } = normalizar(f);
  let t = new Date(ahora);
  for (let i = 0; i < 1000; i++) {
    const v = ventanaRegistro(f, t);
    const p = periodoActual(f, t);
    if (tocaEnFecha(f, t) && enRango(fechas, p.inicio, p.fin) < veces && enRango(fechas, v.inicio, v.fin) === 0) return t;
    // Siguiente ventana, sin saltarse el inicio del siguiente periodo (p. ej. el día 1 del mes)
    t = p.fin > t && p.fin < v.fin ? p.fin : v.fin;
  }
  return null;
}

/** "a las 11:00", "mañana", "el miércoles" o "el 1 de diciembre". */
export function cuando(fecha: Date, ahora = new Date()): string {
  const dias = Math.round((inicioDia(fecha).getTime() - inicioDia(ahora).getTime()) / 86_400_000);
  if (dias <= 0) return fecha <= ahora ? "ahora" : `a las ${dos(fecha.getHours())}:00`;
  if (dias === 1) return "mañana";
  if (dias < 7) return `el ${LARGO_DIA[fecha.getDay()]} ${fecha.getDate()}`;
  return `el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

export type CodigoRegistro = "OK" | "NO_TOCA" | "LIMITE_PERIODO" | "YA_EN_VENTANA";

/** ¿Puede registrar una sesión ahora? Con el porqué y cuándo podrá, para mostrarlo tal cual. */
export function estadoRegistro(f: Frecuencia, fechasIn: (Date | string)[], ahora = new Date()) {
  const { veces } = normalizar(f);
  const fechas = fechasIn.map((d) => new Date(d));
  const periodo = periodoActual(f, ahora);
  const ventana = ventanaRegistro(f, ahora);
  const hechas = enRango(fechas, periodo.inicio, periodo.fin);
  const progreso = `${hechas} de ${veces} ${periodo.este}`;
  const prox = proximaOportunidad(f, fechas, ahora);
  const cuandoProx = prox ? cuando(prox, ahora) : "más adelante";
  const base = { veces, hechas, progreso, ventana, periodo, proxima: prox, cuandoProx, dias: textoDias(f) };

  if (!tocaEnFecha(f, ahora)) {
    return { ...base, puede: false, codigo: "NO_TOCA" as CodigoRegistro, titulo: "Hoy no te toca esta rutina",
      mensaje: `Te toca ${cuandoToca(f)}. La próxima sesión es ${cuandoProx}.` };
  }
  if (hechas >= veces) {
    return { ...base, puede: false, codigo: "LIMITE_PERIODO" as CodigoRegistro, titulo: `Ya completaste esta rutina ${periodo.este}`,
      mensaje: `Hiciste ${hechas} de ${veces} ${veces === 1 ? "sesión" : "sesiones"}. Podrás registrarla de nuevo ${cuandoProx}.` };
  }
  if (enRango(fechas, ventana.inicio, ventana.fin) > 0) {
    return { ...base, puede: false, codigo: "YA_EN_VENTANA" as CodigoRegistro, titulo: `Ya registraste esta rutina ${ventana.ya}`,
      mensaje: `Llevas ${progreso}. Podrás registrarla de nuevo ${cuandoProx}.` };
  }
  return { ...base, puede: true, codigo: "OK" as CodigoRegistro, titulo: "", mensaje: `Llevas ${progreso}.` };
}

/**
 * ¿Hay que recordarle hoy esta rutina? Al empezar el día:
 *   - con días elegidos: los días que le tocan;
 *   - diaria o semanal sin días: mientras le falten sesiones del periodo;
 *   - mensual sin días: los lunes y el día 1, si le faltan sesiones del mes.
 */
export function debeRecordar(f: Frecuencia, fechas: (Date | string)[], hoy = new Date()) {
  const e = estadoRegistro(f, fechas, hoy);
  const { periodo, dias } = normalizar(f);
  if (e.codigo === "NO_TOCA" || e.hechas >= e.veces) return null;
  if (periodo === "mes" && !dias.length && hoy.getDay() !== 1 && hoy.getDate() !== 1) return null;
  const faltan = e.veces - e.hechas;
  // Con días fijos hoy es uno de sus días; sin días fijos, cuántas le faltan del periodo
  if (dias.length) return { faltan, texto: `hoy es uno de tus días (llevas ${e.progreso})` };
  return { faltan, texto: `te ${faltan === 1 ? "falta 1 sesión" : `faltan ${faltan} sesiones`} ${e.periodo.este}` };
}

export const nombreDia = (n: number) => CORTO_DIA[n];
