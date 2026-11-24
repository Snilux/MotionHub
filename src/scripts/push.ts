// Notificaciones push en el navegador o la app instalada (PWA).
//
// El permiso lo pide el navegador al llamar a Notification.requestPermission(),
// y debe hacerse directamente desde un clic del usuario (por eso es lo primero
// que hace activarPush). En iPhone/iPad solo funciona con la app instalada en la
// pantalla de inicio (iOS 16.4 o posterior).

const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esAppInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

/** ¿Por qué no se pueden usar notificaciones aquí? null si sí se puede. */
export function motivoSinPush(): string | null {
  if (!window.isSecureContext) return "Las notificaciones requieren abrir la página con una conexión segura (https).";
  if (esIOS() && !esAppInstalada()) {
    return "En iPhone, primero instala MotionHub: toca Compartir › «Agregar a inicio», abre la app desde ese ícono y activa aquí las notificaciones.";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "Tu navegador no admite notificaciones. Actualízalo o prueba con otro navegador.";
  }
  return null;
}

/** Cómo reactivar el permiso si se negó (el navegador ya no vuelve a preguntar). */
export function comoActivarNotificaciones(): string {
  if (esIOS()) return "Para activarlas ve a Ajustes del iPhone › Notificaciones › MotionHub y activa «Permitir notificaciones».";
  if (/Android/i.test(navigator.userAgent)) {
    return esAppInstalada()
      ? "Para activarlas mantén presionado el ícono de MotionHub › Información de la app › Notificaciones › Permitir."
      : "Para activarlas toca el ícono junto a la dirección de la página › Permisos › Notificaciones › Permitir.";
  }
  return "Para activarlas haz clic en el ícono junto a la dirección de la página (el candado o los ajustes del sitio) y permite las notificaciones.";
}

async function registro(): Promise<ServiceWorkerRegistration> {
  // En producción HeadAssets ya registra el service worker; en desarrollo se registra aquí
  if (!(await navigator.serviceWorker.getRegistration("/"))) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

const aBytes = (base64url: string) => {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.href = `/login?razon=${data?.razon ?? "expiracion"}`;
  return { ok: res.ok, data };
}

export type EstadoPush = "no-soportado" | "no-configurado" | "bloqueado" | "activo" | "inactivo";

/** Estado en este dispositivo (sin pedir permiso). */
export async function estadoPush(): Promise<{ estado: EstadoPush; motivo?: string }> {
  const motivo = motivoSinPush();
  if (motivo) return { estado: "no-soportado", motivo };
  if (Notification.permission === "denied") return { estado: "bloqueado", motivo: comoActivarNotificaciones() };
  const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
  const { data } = await json(`/api/push${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ""}`);
  if (!data.configurado) return { estado: "no-configurado", motivo: "Las notificaciones aún no están configuradas en el servidor." };
  return { estado: sub && data.suscrito && Notification.permission === "granted" ? "activo" : "inactivo" };
}

/** Pide el permiso y suscribe este dispositivo. Devuelve un error legible o null. */
export async function activarPush(): Promise<string | null> {
  const motivo = motivoSinPush();
  if (motivo) return motivo;

  // Lo primero: aquí el navegador (o la app instalada) muestra el aviso de permiso
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") {
    return permiso === "denied"
      ? `No diste permiso para las notificaciones. ${comoActivarNotificaciones()}`
      : "No se activaron las notificaciones. Inténtalo de nuevo y elige «Permitir».";
  }

  try {
    const { data } = await json("/api/push");
    if (!data.configurado) return "Las notificaciones aún no están configuradas en el servidor.";
    const reg = await registro();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(data.clavePublica) }));
    const r = await json("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return r.ok ? null : r.data.error || "No se pudo activar las notificaciones";
  } catch (e) {
    console.error("Activar push:", e);
    return "No se pudo activar las notificaciones en este dispositivo. Inténtalo de nuevo.";
  }
}

/** Quita la suscripción de este dispositivo. */
export async function desactivarPush(): Promise<string | null> {
  try {
    const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
    if (sub) {
      await json("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    return null;
  } catch {
    return "No se pudo desactivar las notificaciones";
  }
}
