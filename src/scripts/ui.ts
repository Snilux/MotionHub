// Utilidades de interfaz para el dashboard: avisos (toast), diálogo de
// confirmación, llamadas a la API y modales.

type TipoAviso = "exito" | "error" | "info";

/** Muestra un aviso flotante que desaparece solo. */
export function aviso(mensaje: string, tipo: TipoAviso = "info", ms = 3500) {
  let cont = document.getElementById("mh-avisos");
  if (!cont) {
    cont = document.createElement("div");
    cont.id = "mh-avisos";
    cont.setAttribute("aria-live", "polite");
    cont.className = "fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 items-end pointer-events-none";
    document.body.appendChild(cont);
  }
  const colores: Record<TipoAviso, string> = {
    exito: "bg-black text-white border-black",
    error: "bg-red-50 text-red-700 border-red-300",
    info: "bg-white text-gray-900 border-stone-300",
  };
  const el = document.createElement("div");
  el.className = `pointer-events-auto max-w-sm w-full sm:w-auto border rounded-xl px-4 py-3 text-base shadow-lg transition-all duration-300 opacity-0 translate-y-2 ${colores[tipo]}`;
  el.textContent = mensaje;
  cont.appendChild(el);
  requestAnimationFrame(() => el.classList.remove("opacity-0", "translate-y-2"));
  setTimeout(() => {
    el.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => el.remove(), 300);
  }, ms);
}

type TipoAlerta = "exito" | "info" | "error";

const ICONOS_ALERTA: Record<TipoAlerta, string> = {
  exito: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

/**
 * Alerta que el usuario debe cerrar: confirma que una acción se realizó (o por
 * qué no). Resuelve al cerrarla con el botón, Escape o un clic fuera.
 */
export function alerta(opts: { titulo: string; mensaje?: string; tipo?: TipoAlerta; aceptar?: string }): Promise<void> {
  const tipo = opts.tipo ?? "exito";
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[60] bg-black/30 dark:bg-[#000]/60 flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div role="alertdialog" aria-modal="true" class="bg-white rounded-lg border border-gray-200 shadow-lg p-6 w-full max-w-sm text-center">
        <div class="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center ${
          tipo === "error" ? "bg-red-50 text-red-600" : "bg-stone-100 text-gray-900"
        }">${ICONOS_ALERTA[tipo]}</div>
        <h2 class="font-baloo tracking-wide text-2xl mb-1"><strong></strong></h2>
        <p class="text-base text-gray-600 mb-6"></p>
        <button class="w-full px-4 py-2.5 rounded-lg text-base font-medium bg-black text-white hover:bg-gray-800 transition-colors"></button>
      </div>`;
    overlay.querySelector("strong")!.textContent = opts.titulo;
    const p = overlay.querySelector("p")!;
    if (opts.mensaje) p.textContent = opts.mensaje;
    else p.remove();
    const btn = overlay.querySelector("button")!;
    btn.textContent = opts.aceptar ?? "Entendido";

    const cerrar = () => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve();
    };
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && (e.preventDefault(), cerrar());
    btn.addEventListener("click", cerrar);
    overlay.addEventListener("click", (e) => e.target === overlay && cerrar());
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    btn.focus();
  });
}

/**
 * Confirma que la acción se realizó y, cuando el usuario cierra la alerta,
 * recarga la página (o va a `destino`). Quien la llama no debe volver a
 * habilitar el botón: así no se puede repetir la acción mientras tanto.
 */
let saliendo = false; // la página va a recargar o navegar: los botones no se vuelven a habilitar

export async function exito(titulo: string, mensaje?: string, destino?: string) {
  await alerta({ titulo, mensaje, tipo: "exito" });
  saliendo = true;
  if (destino) location.href = destino;
  else location.reload();
}

/** Diálogo de confirmación. Resuelve true si el usuario acepta. */
export function confirmar(opts: {
  titulo: string;
  mensaje?: string;
  aceptar?: string;
  cancelar?: string;
  peligro?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[60] bg-black/30 dark:bg-[#000]/60 flex items-center justify-center p-4";
    overlay.innerHTML = `
      <div role="alertdialog" aria-modal="true" class="bg-white rounded-lg border border-gray-200 shadow-lg p-6 w-full max-w-sm">
        <h2 class="font-baloo tracking-wide text-2xl mb-1"><strong></strong></h2>
        <p class="text-base text-gray-600 mb-6"></p>
        <div class="flex gap-2">
          <button data-r="0" class="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-base font-medium hover:border-gray-400 transition-colors"></button>
          <button data-r="1" class="flex-1 px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
            opts.peligro ? "bg-red-600 text-white hover:bg-red-700" : "bg-black text-white hover:bg-gray-800"
          }"></button>
        </div>
      </div>`;
    overlay.querySelector("strong")!.textContent = opts.titulo;
    const p = overlay.querySelector("p")!;
    if (opts.mensaje) p.textContent = opts.mensaje;
    else p.remove();
    const [btnNo, btnSi] = overlay.querySelectorAll("button");
    btnNo.textContent = opts.cancelar ?? "Cancelar";
    btnSi.textContent = opts.aceptar ?? "Aceptar";

    const cerrar = (r: boolean) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(r);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar(false);
    btnNo.addEventListener("click", () => cerrar(false));
    btnSi.addEventListener("click", () => cerrar(true));
    overlay.addEventListener("click", (e) => e.target === overlay && cerrar(false));
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    btnSi.focus();
  });
}

/** fetch + JSON (o FormData) con manejo de sesión expirada y errores de red. */
export async function api<T = any>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    // FormData (archivos) se envía tal cual: el navegador pone el Content-Type multipart
    const esForm = body instanceof FormData;
    const res = await fetch(url, {
      method,
      headers: body !== undefined && !esForm ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : esForm ? body : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.dispatchEvent(new Event("mh:actividad"));
    if (res.status === 401) {
      // Sesión expirada o abierta en otro navegador
      window.location.href = `/login?razon=${data?.razon ?? "expiracion"}`;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Sin conexión con el servidor" } as any };
  }
}

/**
 * Descarga un archivo generado por la API (p. ej. un PDF) con el mismo manejo
 * de sesión que `api`. Devuelve el mensaje de error, o null si se descargó.
 */
export async function descargar(url: string, nombrePorDefecto: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      window.location.href = `/login?razon=${data?.razon ?? "expiracion"}`;
      return "Tu sesión expiró";
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data?.error ?? "No se pudo descargar el archivo";
    }
    window.dispatchEvent(new Event("mh:actividad"));

    const nombre = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? nombrePorDefecto;
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return null;
  } catch {
    return "Sin conexión con el servidor";
  }
}

/**
 * Evita que una acción se ejecute dos veces a la vez (doble clic):
 * deshabilita el botón mientras la promesa está en curso.
 */
export function unaVez(btn: HTMLButtonElement, accion: () => Promise<unknown>, textoCargando?: string) {
  let enCurso = false;
  btn.addEventListener("click", async () => {
    if (enCurso) return;
    enCurso = true;
    const original = btn.textContent;
    btn.disabled = true;
    btn.classList.add("opacity-60", "cursor-wait");
    if (textoCargando) btn.textContent = textoCargando;
    try {
      await accion();
    } finally {
      if (saliendo) return; // la acción terminó bien y la página recarga: el botón sigue bloqueado
      enCurso = false;
      btn.disabled = false;
      btn.classList.remove("opacity-60", "cursor-wait");
      if (textoCargando) btn.textContent = original;
    }
  });
}

/** Abre/cierra un modal. Al cerrar ejecuta `alCerrar` (para limpiar el formulario). */
export function modal(id: string, alCerrar?: () => void) {
  const el = document.getElementById(id)!;
  const abierto = () => !el.classList.contains("hidden");
  const cerrar = () => {
    if (!abierto()) return;
    el.classList.add("hidden");
    alCerrar?.();
  };
  el.addEventListener("click", (e) => e.target === el && cerrar());
  document.addEventListener("keydown", (e) => e.key === "Escape" && abierto() && cerrar());
  return {
    abrir: () => {
      el.classList.remove("hidden");
      el.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
    },
    cerrar,
  };
}

export const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

/** Muestra u oculta un mensaje de error dentro de un formulario. */
export function errorEn(id: string, mensaje?: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = mensaje ?? "";
  el.classList.toggle("hidden", !mensaje);
}

/** Si la URL trae ?nuevo=1 ejecuta la acción (abrir formulario) y limpia el parámetro. */
export function abrirSiNuevo(accion: () => void) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("nuevo") === "1") {
    url.searchParams.delete("nuevo");
    history.replaceState(null, "", url);
    accion();
  }
}
