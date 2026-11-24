import type { APIRoute } from "astro";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { UPLOADS_DIR, contentType, rutaSegura, tamanoArchivo } from "../../lib/storage";
import { CARPETA_VIDEOS, puedeVerVideo } from "../../lib/rutina";
import { CARPETA_NOTAS_VOZ, puedeOirNotaVoz } from "../../lib/notaVoz";

// GET /archivos/<ruta> - Entrega un archivo del volumen de subidas.
// El middleware ya exige sesión válida (ruta común en src/middleware/index.ts).
// Se envía en streaming y admite peticiones Range, necesarias para que los
// videos se puedan adelantar y para que Safari/iOS los reproduzca.
export const GET: APIRoute = async ({ params, locals, request }) => {
  if (!locals.session) return new Response("No autenticado", { status: 401 });

  const ruta = params.ruta ?? "";
  const tipo = contentType(ruta);
  const abs = rutaSegura(ruta);
  if (!tipo || !abs) return new Response("No encontrado", { status: 404 });

  // Videos de ejercicios: solo el médico de la rutina y su paciente.
  // Se responde 404 (no 403) para no revelar si el archivo existe.
  // Se usa la ruta normalizada para que "avatars/../videos/x.mp4" no evite la comprobación
  const normalizada = path.relative(UPLOADS_DIR, abs).split(path.sep).join("/");
  if (normalizada.startsWith(`${CARPETA_VIDEOS}/`) && !(await puedeVerVideo(normalizada, locals.session.userId))) {
    return new Response("No encontrado", { status: 404 });
  }
  // Notas de voz: solo el paciente que la grabó y el médico de esa sesión
  if (normalizada.startsWith(`${CARPETA_NOTAS_VOZ}/`) && !(await puedeOirNotaVoz(normalizada, locals.session.userId))) {
    return new Response("No encontrado", { status: 404 });
  }

  const total = await tamanoArchivo(ruta);
  if (total === null) return new Response("No encontrado", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": tipo,
    "Accept-Ranges": "bytes",
    // El nombre cambia en cada subida, así que puede cachearse; "private" evita cachés compartidas
    "Cache-Control": "private, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  let inicio = 0;
  let fin = total - 1;
  let status = 200;

  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && total > 0) {
    if (!m || (!m[1] && !m[2])) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    if (m[1]) {
      inicio = Number(m[1]);
      if (m[2]) fin = Math.min(Number(m[2]), total - 1);
    } else {
      // "bytes=-N": los últimos N bytes
      inicio = Math.max(total - Number(m[2]), 0);
    }
    if (inicio > fin || inicio >= total) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${inicio}-${fin}/${total}`;
  }

  headers["Content-Length"] = String(total === 0 ? 0 : fin - inicio + 1);
  if (total === 0) return new Response(null, { status: 200, headers });

  const stream = Readable.toWeb(createReadStream(abs, { start: inicio, end: fin })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
};
