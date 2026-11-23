import type { APIRoute } from "astro";
import connectDB from "../../../lib/db";
import { Expediente } from "../../../models/Expediente";
import { User } from "../../../models/User";
import { getSessionFromRequest, json } from "../../../lib/session";
import { esMiPaciente } from "../../../lib/medico";
import { generarPdfExpediente, nombreArchivoExpediente } from "../../../lib/pdfExpediente";

// GET /api/medico/expediente-pdf?paciente=id - Exporta el expediente en PDF.
// Solo el médico que tiene asignado al paciente.
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const session = getSessionFromRequest(request);
    if (!session || session.role !== "medico") return json({ error: "No autorizado" }, 403);

    await connectDB();
    const pacienteId = url.searchParams.get("paciente");
    if (!(await esMiPaciente(session.userId, pacienteId))) return json({ error: "Paciente no encontrado" }, 404);

    const [exp, paciente, medico] = await Promise.all([
      Expediente.findOne({ paciente: pacienteId })
        .populate("medico", "nombre apellido")
        .populate("evolucion.medico", "nombre apellido")
        .lean(),
      User.findById(pacienteId).select("nombre apellido email telefono fechaNacimiento").lean(),
      User.findById(session.userId).select("nombre apellido").lean(),
    ]);
    if (!exp || !paciente) return json({ error: "El paciente aún no tiene expediente" }, 404);

    const pdf = await generarPdfExpediente({
      paciente,
      exp,
      generadoPor: medico ? `Dr. ${medico.nombre} ${medico.apellido}` : `Dr. ${session.nombre}`,
    });

    return new Response(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivoExpediente(paciente)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET expediente PDF error:", error);
    return json({ error: "No se pudo generar el PDF" }, 500);
  }
};
