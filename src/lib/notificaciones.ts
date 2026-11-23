import { User } from "../models/User";
import {
  enviarAvisoCita,
  enviarAvisoSugerencia,
  enviarAvisoMedicoPorVerificar,
  enviarAvisoVerificacion,
  enviarEnSegundoPlano,
  siteUrl,
  type AvisoCita,
  type AvisoSugerencia,
} from "./email";
import { ETIQUETA_CAMPO, type CampoSugerible } from "./expediente";

// paciente / medico pueden venir como ObjectId o ya poblados
const idDe = (v: any) => String(v?._id ?? v);

/**
 * Avisa por correo de un cambio en una cita, sin hacer esperar la respuesta HTTP.
 * Los avisos "*_paciente" van al médico; el resto, al paciente.
 * Recibe los datos de la cita (sirve también para una cita recién borrada).
 */
export function notificarCita(
  cita: { fecha: Date; duracion: number; tipo: string; paciente: unknown; medico: unknown; motivoCancelacion?: string },
  aviso: AvisoCita,
  { fechaAnterior, origen }: { fechaAnterior?: Date; origen: string },
) {
  enviarEnSegundoPlano(
    (async () => {
      const [paciente, medico] = await Promise.all([
        User.findById(idDe(cita.paciente)).select("nombre apellido email").lean(),
        User.findById(idDe(cita.medico)).select("nombre apellido email").lean(),
      ]);
      if (!paciente || !medico) return;

      const paraMedico = aviso.endsWith("_paciente");
      const destino = paraMedico ? medico : paciente;
      const otro = paraMedico ? `${paciente.nombre} ${paciente.apellido}` : `Dr. ${medico.nombre} ${medico.apellido}`;
      const panel = `${siteUrl(origen)}/dashboard/${paraMedico ? "medico" : "paciente"}/citas`;

      await enviarAvisoCita(
        destino.email,
        destino.nombre,
        aviso,
        {
          fecha: cita.fecha,
          duracion: cita.duracion,
          tipo: cita.tipo,
          fechaAnterior,
          motivo: cita.motivoCancelacion,
          conQuien: otro,
        },
        panel,
      );
    })(),
    `cita ${aviso}`,
  );
}

/**
 * Avisa por correo de una sugerencia al expediente, sin hacer esperar la respuesta HTTP.
 * "nueva" va al médico asignado del paciente; "aprobada"/"rechazada", al paciente.
 */
export function notificarSugerencia(
  solicitud: { paciente: unknown; campo: CampoSugerible; revisadaPor?: unknown },
  aviso: AvisoSugerencia,
  { origen }: { origen: string },
) {
  enviarEnSegundoPlano(
    (async () => {
      const paciente = await User.findById(idDe(solicitud.paciente)).select("nombre apellido email medicoAsignado").lean();
      const medicoId = aviso === "nueva" ? paciente?.medicoAsignado : solicitud.revisadaPor;
      if (!paciente || !medicoId) return;
      const medico = await User.findById(idDe(medicoId)).select("nombre apellido email").lean();
      if (!medico) return;

      const paraMedico = aviso === "nueva";
      const destino = paraMedico ? medico : paciente;
      const panel = paraMedico
        ? `${siteUrl(origen)}/dashboard/medico/expedientes?paciente=${paciente._id}`
        : `${siteUrl(origen)}/dashboard/paciente/expediente`;

      await enviarAvisoSugerencia(
        destino.email,
        destino.nombre,
        aviso,
        {
          conQuien: paraMedico ? `${paciente.nombre} ${paciente.apellido}` : `Dr. ${medico.nombre} ${medico.apellido}`,
          campo: ETIQUETA_CAMPO[solicitud.campo],
        },
        panel,
      );
    })(),
    `sugerencia ${aviso}`,
  );
}

/** Avisa a todos los administradores de que un médico espera verificación. */
export function notificarMedicoPorVerificar(medicoId: unknown, { origen, reenvio = false }: { origen: string; reenvio?: boolean }) {
  enviarEnSegundoPlano(
    (async () => {
      const [medico, admins] = await Promise.all([
        User.findById(idDe(medicoId)).select("nombre apellido email cedulaProfesional especialidad").lean(),
        User.find({ role: "admin" }).select("nombre email").lean(),
      ]);
      if (!medico) return;
      const panel = `${siteUrl(origen)}/dashboard/admin/medicos?medico=${medico._id}`;
      await Promise.all(
        admins.map((a) =>
          enviarAvisoMedicoPorVerificar(
            a.email,
            a.nombre,
            {
              nombre: `${medico.nombre} ${medico.apellido}`,
              email: medico.email,
              cedula: medico.cedulaProfesional ?? "—",
              especialidad: medico.especialidad ?? "—",
              reenvio,
            },
            panel,
          ),
        ),
      );
    })(),
    "médico por verificar",
  );
}

/** Avisa al médico del resultado de su verificación. */
export function notificarVerificacion(
  medico: { email: string; nombre: string },
  aprobada: boolean,
  motivo: string | undefined,
  { origen }: { origen: string },
) {
  const panel = `${siteUrl(origen)}/dashboard/medico${aprobada ? "" : "/verificacion"}`;
  enviarEnSegundoPlano(enviarAvisoVerificacion(medico.email, medico.nombre, aprobada, motivo, panel), "verificación médico");
}
