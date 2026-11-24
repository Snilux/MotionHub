// Grabadora de notas de voz (MediaRecorder).
//
// Permiso del micrófono: el navegador lo pide la primera vez que se llama a
// getUserMedia, tanto en la web como en la app instalada (PWA). Si el paciente
// lo negó, el navegador ya no vuelve a preguntar: solo se puede reactivar desde
// los ajustes, así que se le explica cómo hacerlo según su dispositivo.

export interface NotaGrabada {
  blob: Blob;
  duracion: number; // segundos
  nombre: string; // nombre de archivo con la extensión correcta
}

interface Opciones {
  maxSegundos: number;
  /** Cambió el estado (para actualizar la interfaz). */
  alCambiar: (estado: "inactiva" | "pidiendo" | "grabando" | "lista") => void;
  /** Cada segundo mientras graba. */
  alTick: (segundos: number) => void;
  /** Mensaje para el paciente (permiso negado, sin micrófono, etc.). */
  alAviso: (mensaje: string) => void;
}

// Formatos en orden de preferencia; Safari/iOS solo graba en MP4
const FORMATOS = [
  { mime: "audio/webm;codecs=opus", ext: "weba" },
  { mime: "audio/webm", ext: "weba" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  { mime: "audio/mp4", ext: "m4a" },
];

const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esAppInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

/** Instrucciones para reactivar el micrófono según el dispositivo y si es la app instalada. */
export function comoActivarMicrofono(): string {
  if (esIOS()) {
    return "Para activarlo ve a Ajustes del iPhone › Safari › Micrófono y elige «Preguntar» o «Permitir». Después vuelve a abrir MotionHub.";
  }
  if (/Android/i.test(navigator.userAgent)) {
    return esAppInstalada()
      ? "Para activarlo mantén presionado el ícono de MotionHub › Información de la app › Permisos › Micrófono › Permitir."
      : "Para activarlo toca el ícono junto a la dirección de la página › Permisos › Micrófono › Permitir.";
  }
  return "Para activarlo haz clic en el ícono junto a la dirección de la página (el candado o los ajustes del sitio) y permite el micrófono. Después vuelve a intentarlo.";
}

/** Estado del permiso sin pedirlo (null si el navegador no lo informa). */
export async function estadoPermiso(): Promise<PermissionState | null> {
  try {
    const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return p.state;
  } catch {
    return null;
  }
}

/** ¿Este navegador puede grabar? Devuelve el motivo si no. */
export function motivoSinGrabacion(): string | null {
  if (!window.isSecureContext) {
    return "Para grabar notas de voz la página debe abrirse con una conexión segura (https).";
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return "Tu navegador no permite grabar audio. Actualízalo o prueba con otro navegador.";
  }
  return null;
}

export function crearGrabadora(op: Opciones) {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let trozos: Blob[] = [];
  let inicio = 0;
  let reloj: ReturnType<typeof setInterval> | null = null;
  let nota: NotaGrabada | null = null;
  let descartando = false;

  const liberar = () => {
    if (reloj) clearInterval(reloj);
    reloj = null;
    stream?.getTracks().forEach((t) => t.stop()); // apaga el indicador de micrófono del sistema
    stream = null;
  };

  async function grabar() {
    const motivo = motivoSinGrabacion();
    if (motivo) return op.alAviso(motivo);
    if (recorder?.state === "recording") return;

    op.alCambiar("pidiendo");
    try {
      // Aquí el navegador (o la app instalada) muestra el aviso de permiso
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      liberar();
      op.alCambiar(nota ? "lista" : "inactiva");
      const nombre = (e as DOMException)?.name;
      if (nombre === "NotAllowedError" || nombre === "SecurityError") {
        return op.alAviso(`No diste permiso para usar el micrófono. ${comoActivarMicrofono()}`);
      }
      if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
        return op.alAviso("No se encontró ningún micrófono en este dispositivo.");
      }
      if (nombre === "NotReadableError" || nombre === "AbortError") {
        return op.alAviso("El micrófono está siendo usado por otra app. Ciérrala e inténtalo de nuevo.");
      }
      return op.alAviso("No se pudo acceder al micrófono. Inténtalo de nuevo.");
    }

    const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f.mime));
    try {
      recorder = new MediaRecorder(stream, formato ? { mimeType: formato.mime } : undefined);
    } catch {
      liberar();
      op.alCambiar(nota ? "lista" : "inactiva");
      return op.alAviso("Tu navegador no permite grabar audio. Actualízalo o prueba con otro navegador.");
    }

    trozos = [];
    descartando = false;
    recorder.addEventListener("dataavailable", (e) => e.data.size > 0 && trozos.push(e.data));
    recorder.addEventListener("stop", () => {
      const duracion = Math.max(1, Math.round((Date.now() - inicio) / 1000));
      liberar();
      if (descartando || trozos.length === 0) {
        op.alCambiar(nota ? "lista" : "inactiva");
        return;
      }
      const mime = recorder?.mimeType || formato?.mime || "audio/webm";
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "weba";
      nota = { blob: new Blob(trozos, { type: mime.split(";")[0] }), duracion, nombre: `nota-de-voz.${ext}` };
      op.alCambiar("lista");
    });

    recorder.start(1000); // trozos de 1 s: si algo falla no se pierde todo
    inicio = Date.now();
    op.alTick(0);
    op.alCambiar("grabando");
    reloj = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      op.alTick(seg);
      if (seg >= op.maxSegundos) detener(); // límite de duración
    }, 250);
  }

  function detener() {
    if (recorder?.state === "recording") recorder.stop();
  }

  /** Descarta la grabación en curso y la nota grabada; libera el micrófono. */
  function descartar() {
    descartando = true;
    nota = null;
    if (recorder?.state === "recording") recorder.stop();
    else liberar();
    op.alCambiar("inactiva");
  }

  return {
    grabar,
    detener,
    descartar,
    grabando: () => recorder?.state === "recording",
    nota: () => nota,
  };
}

export const formatoTiempo = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
