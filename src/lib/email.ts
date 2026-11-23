import nodemailer from "nodemailer";

// Lee una variable de entorno desde Vite (.env) o desde el proceso (Docker env_file).
// Se aceptan los nombres SMTP_* y también EMAIL_* (los que usa el .env del proyecto).
const env = (...nombres: string[]): string | undefined => {
  for (const n of nombres) {
    const v = (import.meta.env as Record<string, string | undefined>)[n] ?? process.env[n];
    if (v) return v.trim();
  }
  return undefined;
};

const smtp = {
  host: env("SMTP_HOST", "EMAIL_HOST") ?? "smtp.gmail.com",
  port: Number(env("SMTP_PORT", "EMAIL_PORT")) || 587,
  user: env("SMTP_USER", "EMAIL_USER") ?? "",
  // Gmail muestra la contraseña de aplicación con espacios: se quitan
  pass: (env("SMTP_PASS", "EMAIL_PASS") ?? "").replace(/\s+/g, ""),
  from: env("SMTP_FROM", "EMAIL_FROM"),
};

export const emailConfigurado = () => !!smtp.user && !!smtp.pass;

const transporter = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.port === 465, // 465 = SSL directo; 587 = STARTTLS
  auth: { user: smtp.user, pass: smtp.pass },
});

/** URL pública del sitio para los enlaces de los correos. */
export function siteUrl(fallback?: string): string {
  return (env("SITE_URL", "PUBLIC_SITE_URL") ?? fallback ?? "http://localhost:4321").replace(/\/$/, "");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ── Plantilla común ─────────────────────────────────────────────────────────

interface Correo {
  to: string;
  subject: string;
  titulo: string;
  saludo: string; // nombre del destinatario
  parrafos: string[]; // texto plano; se escapa
  detalles?: { label: string; value: string }[];
  boton?: { texto: string; url: string };
  pie?: string;
}

function html({ titulo, saludo, parrafos, detalles, boton, pie }: Correo) {
  const filas = (detalles ?? [])
    .map(
      (d) => `<tr>
        <td style="padding:6px 16px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(d.label)}</td>
        <td style="padding:6px 0;color:#111827;font-size:15px;font-weight:600;">${escapeHtml(d.value)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f5f5f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;">
    <div style="background:#000000;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:700;letter-spacing:.5px;">MotionHub</div>
    <div style="padding:28px;">
      <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">${escapeHtml(titulo)}</h1>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">Hola <strong>${escapeHtml(saludo)}</strong>,</p>
      ${parrafos.map((p) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`).join("")}
      ${filas ? `<table style="margin:16px 0;border-collapse:collapse;">${filas}</table>` : ""}
      ${
        boton
          ? `<a href="${escapeHtml(boton.url)}" style="display:inline-block;margin:12px 0 4px;padding:12px 24px;background:#000000;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(boton.texto)}</a>
             <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;word-break:break-all;">Si el botón no funciona, copia este enlace en tu navegador:<br>${escapeHtml(boton.url)}</p>`
          : ""
      }
      ${pie ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e7e5e4;color:#6b7280;font-size:13px;line-height:1.5;">${escapeHtml(pie)}</p>` : ""}
    </div>
  </div>
</body></html>`;
}

function texto({ titulo, saludo, parrafos, detalles, boton, pie }: Correo) {
  return [
    titulo,
    "",
    `Hola ${saludo},`,
    "",
    ...parrafos,
    ...(detalles?.length ? ["", ...detalles.map((d) => `${d.label}: ${d.value}`)] : []),
    ...(boton ? ["", `${boton.texto}: ${boton.url}`] : []),
    ...(pie ? ["", pie] : []),
  ].join("\n");
}

async function enviar(correo: Correo) {
  if (!emailConfigurado()) {
    // En desarrollo sin SMTP se muestra el correo en la consola para poder probar el flujo
    if (import.meta.env.DEV) {
      console.info(`\n📧 [SMTP no configurado] Correo para ${correo.to}\n${texto(correo)}\n`);
      return;
    }
    throw new Error("SMTP no configurado: define EMAIL_USER y EMAIL_PASS (o SMTP_USER y SMTP_PASS) en .env");
  }

  await transporter.sendMail({
    from: smtp.from ?? `"MotionHub" <${smtp.user}>`,
    to: correo.to,
    subject: correo.subject,
    text: texto(correo),
    html: html(correo),
  });
}

/**
 * Envía un correo sin hacer esperar la respuesta HTTP. Los errores se registran
 * en el log pero no rompen la acción (p. ej. la cita se guarda aunque falle el SMTP).
 */
export function enviarEnSegundoPlano(envio: Promise<unknown>, contexto: string) {
  envio.catch((error) => console.error(`Correo (${contexto}):`, error));
}

// ── Cuenta ──────────────────────────────────────────────────────────────────

export const RESET_EXPIRA_MIN = 60;

export function sendPasswordResetEmail(to: string, nombre: string, resetUrl: string) {
  return enviar({
    to,
    subject: "Recupera tu contraseña – MotionHub",
    titulo: "Recupera tu contraseña",
    saludo: nombre,
    parrafos: [
      "Recibimos una solicitud para restablecer la contraseña de tu cuenta de MotionHub.",
      `Abre el siguiente enlace para elegir una nueva. Solo funciona una vez y expira en ${RESET_EXPIRA_MIN} minutos.`,
    ],
    boton: { texto: "Restablecer contraseña", url: resetUrl },
    pie: "Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue funcionando.",
  });
}

export function enviarAvisoPasswordCambiada(to: string, nombre: string, loginUrl: string) {
  return enviar({
    to,
    subject: "Tu contraseña se cambió – MotionHub",
    titulo: "Tu contraseña se cambió",
    saludo: nombre,
    parrafos: [
      "La contraseña de tu cuenta de MotionHub se acaba de cambiar y se cerraron las sesiones abiertas en otros dispositivos.",
    ],
    detalles: [{ label: "Fecha", value: fechaHora(new Date()) }],
    boton: { texto: "Iniciar sesión", url: loginUrl },
    pie: "Si no fuiste tú, restablece tu contraseña de inmediato desde «¿Olvidaste tu contraseña?» y avísale a tu clínica.",
  });
}

export const CAMBIO_CORREO_EXPIRA_H = 24;

export function enviarConfirmacionCorreo(to: string, nombre: string, confirmarUrl: string) {
  return enviar({
    to,
    subject: "Confirma tu nuevo correo – MotionHub",
    titulo: "Confirma tu nuevo correo",
    saludo: nombre,
    parrafos: [
      "Pediste usar esta dirección como el correo de tu cuenta de MotionHub.",
      `Confírmala con el siguiente enlace (expira en ${CAMBIO_CORREO_EXPIRA_H} horas). Hasta entonces seguirás entrando con tu correo anterior.`,
    ],
    boton: { texto: "Confirmar correo", url: confirmarUrl },
    pie: "Si no hiciste esta solicitud, ignora este correo.",
  });
}

export function enviarAvisoCambioCorreo(to: string, nombre: string, nuevo: string) {
  return enviar({
    to,
    subject: "Solicitud de cambio de correo – MotionHub",
    titulo: "Solicitud de cambio de correo",
    saludo: nombre,
    parrafos: [
      "Se pidió cambiar el correo de tu cuenta de MotionHub. El cambio se aplicará cuando se confirme desde la nueva dirección.",
    ],
    detalles: [{ label: "Nuevo correo", value: nuevo }],
    pie: "Si no fuiste tú, cambia tu contraseña desde tu perfil: alguien más podría tener acceso a tu cuenta.",
  });
}

// ── Citas ───────────────────────────────────────────────────────────────────

const fechaHora = (d: Date) =>
  d.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short", timeZone: process.env.TZ || "America/Mexico_City" });

export type AvisoCita = "agendada" | "reagendada" | "cancelada" | "confirmada_paciente" | "cancelada_paciente";

interface DatosCita {
  fecha: Date;
  duracion: number;
  tipo: string;
  fechaAnterior?: Date;
  motivo?: string;
  conQuien: string; // "Dr. Juan Pérez" o "María López"
}

const TEXTOS_CITA: Record<AvisoCita, { asunto: string; titulo: string; parrafo: string }> = {
  agendada: {
    asunto: "Nueva cita agendada",
    titulo: "Tienes una nueva cita",
    parrafo: "Tu fisioterapeuta te agendó una cita. Puedes confirmarla o cancelarla desde tu panel de MotionHub.",
  },
  reagendada: {
    asunto: "Tu cita cambió de horario",
    titulo: "Tu cita se reagendó",
    parrafo: "Tu fisioterapeuta cambió el horario de tu cita. Confírmala desde tu panel si el nuevo horario te funciona.",
  },
  cancelada: {
    asunto: "Tu cita se canceló",
    titulo: "Tu cita se canceló",
    parrafo: "Tu fisioterapeuta canceló la siguiente cita. Si necesitas otra, comunícate con tu clínica.",
  },
  confirmada_paciente: {
    asunto: "Un paciente confirmó su cita",
    titulo: "Cita confirmada",
    parrafo: "Tu paciente confirmó que asistirá a la siguiente cita.",
  },
  cancelada_paciente: {
    asunto: "Un paciente canceló su cita",
    titulo: "Cita cancelada por el paciente",
    parrafo: "Tu paciente canceló la siguiente cita. El horario quedó libre en tu agenda.",
  },
};

export function enviarAvisoCita(to: string, nombre: string, aviso: AvisoCita, cita: DatosCita, panelUrl: string) {
  const t = TEXTOS_CITA[aviso];
  const paraMedico = aviso.endsWith("_paciente");
  return enviar({
    to,
    subject: `${t.asunto} – MotionHub`,
    titulo: t.titulo,
    saludo: nombre,
    parrafos: [t.parrafo],
    detalles: [
      { label: paraMedico ? "Paciente" : "Fisioterapeuta", value: cita.conQuien },
      ...(cita.fechaAnterior ? [{ label: "Horario anterior", value: fechaHora(cita.fechaAnterior) }] : []),
      { label: cita.fechaAnterior ? "Nuevo horario" : "Fecha", value: fechaHora(cita.fecha) },
      { label: "Duración", value: `${cita.duracion} min` },
      { label: "Tipo", value: cita.tipo.charAt(0).toUpperCase() + cita.tipo.slice(1) },
      ...(cita.motivo ? [{ label: "Motivo", value: cita.motivo }] : []),
    ],
    boton: { texto: paraMedico ? "Ver mi agenda" : "Ver mis citas", url: panelUrl },
  });
}

// ── Expediente ──────────────────────────────────────────────────────────────
// Los correos no llevan datos clínicos (valores ni respuestas): solo avisan y
// enlazan al panel, donde se consultan con sesión iniciada.

export type AvisoSugerencia = "nueva" | "aprobada" | "rechazada";

const TEXTOS_SUGERENCIA: Record<AvisoSugerencia, { asunto: string; titulo: string; parrafo: string }> = {
  nueva: {
    asunto: "Un paciente sugirió un cambio en su expediente",
    titulo: "Nueva sugerencia en un expediente",
    parrafo: "Tu paciente propuso una modificación a su expediente clínico. No se aplicará hasta que la revises y la confirmes.",
  },
  aprobada: {
    asunto: "Tu sugerencia se integró a tu expediente",
    titulo: "Sugerencia integrada",
    parrafo: "Tu fisioterapeuta revisó tu sugerencia y la integró a tu expediente clínico.",
  },
  rechazada: {
    asunto: "Tu fisioterapeuta revisó tu sugerencia",
    titulo: "Sugerencia revisada",
    parrafo: "Tu fisioterapeuta revisó tu sugerencia y decidió no integrarla a tu expediente. Puedes ver los detalles en tu panel.",
  },
};

export function enviarAvisoSugerencia(
  to: string,
  nombre: string,
  aviso: AvisoSugerencia,
  datos: { conQuien: string; campo: string },
  panelUrl: string,
) {
  const t = TEXTOS_SUGERENCIA[aviso];
  const paraMedico = aviso === "nueva";
  return enviar({
    to,
    subject: `${t.asunto} – MotionHub`,
    titulo: t.titulo,
    saludo: nombre,
    parrafos: [t.parrafo],
    detalles: [
      { label: paraMedico ? "Paciente" : "Fisioterapeuta", value: datos.conQuien },
      { label: "Dato", value: datos.campo },
    ],
    boton: { texto: paraMedico ? "Revisar sugerencia" : "Ver mi expediente", url: panelUrl },
  });
}

// ── Verificación de médicos ─────────────────────────────────────────────────

export function enviarAvisoMedicoPorVerificar(
  to: string,
  nombre: string,
  medico: { nombre: string; email: string; cedula: string; especialidad: string; reenvio: boolean },
  panelUrl: string,
) {
  return enviar({
    to,
    subject: `${medico.reenvio ? "Un fisioterapeuta actualizó su cédula" : "Nuevo fisioterapeuta por verificar"} – MotionHub`,
    titulo: medico.reenvio ? "Cédula actualizada, por verificar" : "Nuevo fisioterapeuta por verificar",
    saludo: nombre,
    parrafos: [
      medico.reenvio
        ? "Un fisioterapeuta cambió sus datos profesionales y su cuenta volvió a revisión."
        : "Un fisioterapeuta se registró en MotionHub. No podrá atender pacientes hasta que verifiques su cédula profesional.",
    ],
    detalles: [
      { label: "Nombre", value: medico.nombre },
      { label: "Correo", value: medico.email },
      { label: "Cédula", value: medico.cedula },
      { label: "Especialidad", value: medico.especialidad },
    ],
    boton: { texto: "Revisar en el panel", url: panelUrl },
  });
}

export function enviarAvisoVerificacion(
  to: string,
  nombre: string,
  aprobada: boolean,
  motivo: string | undefined,
  panelUrl: string,
) {
  return enviar({
    to,
    subject: `${aprobada ? "Tu cuenta fue verificada" : "No pudimos verificar tu cuenta"} – MotionHub`,
    titulo: aprobada ? "¡Tu cuenta está verificada!" : "No pudimos verificar tu cuenta",
    saludo: nombre,
    parrafos: aprobada
      ? ["Verificamos tu cédula profesional. Ya puedes asignar pacientes, agendar citas y llevar sus expedientes en MotionHub."]
      : [
          "Revisamos tus datos profesionales y no pudimos verificarlos, así que por ahora no puedes atender pacientes en MotionHub.",
          "Si hubo un error, corrige tu cédula o especialidad en tu perfil y tu cuenta volverá a revisión.",
        ],
    detalles: !aprobada && motivo ? [{ label: "Motivo", value: motivo }] : undefined,
    boton: { texto: aprobada ? "Ir a mi panel" : "Revisar mis datos", url: panelUrl },
  });
}
