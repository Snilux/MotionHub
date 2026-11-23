import type { APIRoute } from "astro";
import { contentType, leerArchivo } from "../../lib/storage";

// GET /archivos/<ruta> - Entrega un archivo del volumen de subidas.
// El middleware ya exige sesión válida (ruta común en src/middleware/index.ts).
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.session) return new Response("No autenticado", { status: 401 });

  const ruta = params.ruta ?? "";
  const tipo = contentType(ruta);
  if (!tipo) return new Response("No encontrado", { status: 404 });

  const datos = await leerArchivo(ruta);
  if (!datos) return new Response("No encontrado", { status: 404 });

  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(datos.length),
      // El nombre cambia en cada subida, así que puede cachearse; "private" evita cachés compartidas
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
