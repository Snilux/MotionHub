// Recordatorios de sesiones al comenzar el día (correo + notificación push).
//
// Se ejecuta una vez al día (POST /api/cron/recordatorios, lo llama el servicio
// "cron" de docker-compose a las 7:00 hora de México). A cada paciente se le
// envía UN solo aviso con todas las rutinas que le tocan hoy (ver debeRecordar
// en lib/frecuencia.ts). User.recordatorioEnviado guarda el día del último envío:
// si el job corre dos veces el mismo día, no se repite.
import connectDB from "./db";
import { debeRecordar } from "./frecuencia";
import { emailConfigurado, enviarRecordatorioSesiones, siteUrl } from "./email";
import { enviarPush } from "./push";
import { Rutina } from "../models/Rutina";
import { Progreso } from "../models/Progreso";
import { User } from "../models/User";

const dos = (n: number) => String(n).padStart(2, "0");
const claveDia = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ResultadoRecordatorios {
  fecha: string;
  pacientes: number; // a cuántos les toca algo hoy
  correos: number;
  push: number; // notificaciones entregadas (un paciente puede tener varios dispositivos)
  yaEnviados: number; // ya se les había avisado hoy
  errores: number;
  detalle?: { paciente: string; rutinas: string[] }[]; // solo al simular
}

export async function enviarRecordatorios({ ahora = new Date(), simular = false } = {}): Promise<ResultadoRecordatorios> {
  await connectDB();
  const hoy = claveDia(ahora);

  // Rutinas activas con ejercicios y las sesiones desde el lunes o el día 1 (lo que sea antes)
  const rutinas = (await Rutina.find({ activa: true, "ejercicios.0": { $exists: true } })
    .select("nombre paciente frecuenciaVeces frecuenciaPeriodo frecuenciaDias")
    .lean()) as any[];
  const lunes = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - ((ahora.getDay() + 6) % 7));
  const primero = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const sesiones = await Progreso.find({ rutina: { $in: rutinas.map((r) => r._id) }, fecha: { $gte: lunes < primero ? lunes : primero } })
    .select("rutina fecha")
    .lean();

  // Qué le toca hoy a cada paciente
  const porPaciente = new Map<string, { nombre: string; detalle: string }[]>();
  for (const r of rutinas) {
    const fechas = sesiones.filter((s) => String(s.rutina) === String(r._id)).map((s) => s.fecha);
    const aviso = debeRecordar(r, fechas, ahora);
    if (!aviso) continue;
    const id = String(r.paciente);
    porPaciente.set(id, [...(porPaciente.get(id) ?? []), { nombre: r.nombre, detalle: mayuscula(aviso.texto) }]);
  }

  const pacientes = await User.find({ _id: { $in: [...porPaciente.keys()] }, role: "paciente" })
    .select("nombre email recordatoriosCorreo")
    .lean();
  const res: ResultadoRecordatorios = { fecha: hoy, pacientes: pacientes.length, correos: 0, push: 0, yaEnviados: 0, errores: 0 };
  if (simular) {
    res.detalle = pacientes.map((p) => ({
      paciente: `${p.nombre} <${p.email}>`,
      rutinas: porPaciente.get(String(p._id))!.map((r) => `${r.nombre}: ${r.detalle}`),
    }));
    return res;
  }

  const base = siteUrl();
  for (const p of pacientes) {
    // Reserva el envío de hoy de forma atómica: si otro proceso ya lo hizo, se salta
    const reserva = await User.updateOne({ _id: p._id, recordatorioEnviado: { $ne: hoy } }, { $set: { recordatorioEnviado: hoy } });
    if (reserva.modifiedCount === 0) {
      res.yaEnviados++;
      continue;
    }
    const lista = porPaciente.get(String(p._id))!;

    if (p.recordatoriosCorreo !== false && (emailConfigurado() || import.meta.env.DEV)) {
      try {
        await enviarRecordatorioSesiones(p.email, p.nombre, lista, `${base}/dashboard/paciente/rutinas`, `${base}/dashboard/paciente/rutinas#recordatorios`);
        res.correos++;
      } catch (e) {
        res.errores++;
        console.error("Recordatorio (correo):", p.email, e);
      }
    }

    try {
      res.push += await enviarPush(p._id, {
        titulo: lista.length === 1 ? `Hoy te toca «${lista[0].nombre}»` : `Hoy te tocan ${lista.length} rutinas`,
        cuerpo: lista.map((r) => (lista.length === 1 ? r.detalle : `${r.nombre}: ${r.detalle.toLowerCase()}`)).join(" · "),
        url: "/dashboard/paciente/rutinas",
        etiqueta: `recordatorio-${hoy}`,
      });
    } catch (e) {
      res.errores++;
      console.error("Recordatorio (push):", e);
    }
  }
  return res;
}
