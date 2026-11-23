# MotionHub — Pendientes y recomendaciones

_Última actualización: 19 nov 2026_

## 1. Iniciar sesión con Google (código listo, falta configurarlo)

El flujo ya está implementado (OAuth 2.0, sin dependencias nuevas):

- `src/lib/google.ts`: configuración, URL de Google e intercambio del código.
- `src/pages/api/auth/google/index.ts`: redirige a Google.
- `src/pages/api/auth/google/callback.ts`: vuelve de Google, vincula o inicia sesión.
- `src/pages/completar-registro.astro` + `api/auth/google/completar.ts`: un usuario nuevo elige **fisioterapeuta o paciente**.
- Médico con sesión abierta en otro navegador: se le pide confirmación en `/login` (`razon=sesion_activa_google`).

### Pasos para activarlo

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea o elige un proyecto.
2. En **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - tipo **Externo**;
   - nombre de la app, correo de soporte;
   - scopes `openid`, `email`, `profile`;
   - mientras esté en modo *Prueba*, agrega los correos que van a probar.
3. En **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - tipo **Aplicación web**;
   - **URI de redirección autorizada:** `http://localhost:4321/api/auth/google/callback`;
   - en producción agrega también `https://TU-DOMINIO/api/auth/google/callback`.
4. Copia el ID y el secreto en `.env` (las líneas ya existen):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   SITE_URL=http://localhost:4321   # en producción: https://TU-DOMINIO
   ```
5. Reinicia el contenedor: `docker compose up -d --force-recreate app`.
6. Prueba los tres casos:
   - correo nuevo: debe pedir el rol;
   - correo ya registrado con contraseña: debe vincularse y entrar;
   - médico con sesión abierta en otro navegador: debe pedir confirmación.

Para publicar la app a cualquier usuario hay que pasar la pantalla de consentimiento a **Producción**. Con solo los scopes básicos no requiere verificación de Google.

## 2. Foto de perfil (pendiente: elegir almacenamiento)

Estado actual: el botón "Cambiar foto" está deshabilitado en `src/components/dashboard/ProfileView.astro`. Se muestran las iniciales.

Plan sugerido:

1. Elegir el almacenamiento (ver la sección 4).
2. Añadir el campo `avatarUrl` (y `avatarKey` para poder borrarla) al modelo `User`.
3. Crear el endpoint `POST /api/perfil/avatar`:
   - valida el tipo (JPG/PNG/WebP) y el tamaño (máx. 2 MB);
   - devuelve una URL firmada de subida.
4. En el cliente: recortar a cuadrado y redimensionar (p. ej. 512×512) antes de subir.
5. Mostrar la foto en el perfil, en el menú lateral, en la lista de pacientes, en las citas y en los expedientes.
6. Botón "Eliminar foto": borra el archivo y limpia el campo.

## 3. Videos de ejercicios (pendiente, va de la mano con la foto)

Estado actual: el botón "+ Agregar video · próximamente" está deshabilitado en el formulario de ejercicios (`src/pages/dashboard/medico/rutinas.astro`). El modelo `Rutina` ya tiene el campo `videoUrl` en cada ejercicio.

Plan sugerido:

1. Subida directa del navegador al almacenamiento con URL firmada, para no pasar el archivo por el servidor de Astro.
2. Límites: MP4/WebM/MOV, máximo unos 100 MB o 2–3 minutos por video.
3. Guardar `videoUrl` y `videoKey` en el ejercicio.
4. Reproductor en la vista de rutinas del paciente (`src/pages/dashboard/paciente/rutinas.astro`).
5. Opcional: permitir pegar un enlace de YouTube/Vimeo como alternativa sin costo de almacenamiento.
6. Al borrar una rutina o un ejercicio, borrar también su video.

## 4. Recomendación de almacenamiento para fotos y videos

| Opción | Ventajas | Desventajas | Cuándo elegirla |
|---|---|---|---|
| **Cloudflare R2** (recomendada) | API compatible con S3, **sin costo por descarga** (clave con videos), 10 GB gratis, URLs firmadas | No transforma ni comprime videos | Opción por defecto: barata y simple |
| **Cloudinary** | Recorta y redimensiona fotos, y comprime y adapta videos para celular automáticamente | El plan gratuito se agota rápido con videos y luego es caro | Si la reproducción en celular debe ser perfecta sin trabajo extra |
| **AWS S3 + CloudFront** | Estándar de la industria, muy flexible | Cobra por descarga y es más compleja de configurar | Si ya usan AWS |
| **Volumen local en Docker** | Cero configuración | No escala, se pierde si se borra el volumen, sin CDN | Solo para desarrollo |

**Sugerencia:** empezar con **R2** usando el SDK `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` (sirven igual para R2), con un bucket privado y URLs firmadas. Si más adelante los videos pesan demasiado en celular, añadir Cloudinary solo para video.

Datos que harán falta en `.env` para R2:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=motionhub-media
R2_PUBLIC_URL=        # opcional, si se usa un dominio público para servir archivos
```

## 5. Otras recomendaciones (detectadas al revisar el código)

### Seguridad
- [x] `JWT_SECRET`: en producción la app **no arranca** si falta o tiene menos de 32 caracteres (`src/lib/session.ts`). En producción la cookie de sesión lleva además `Secure`.
- [x] Límite de intentos en memoria (`src/lib/rateLimit.ts`): login y forzar-login (30 por IP y 5 fallos por correo cada 15 min), recuperar contraseña (5 por IP / 15 min y 3 por correo / hora), restablecer (10 por IP / 15 min), registro (10 por IP / hora), búsqueda de pacientes (60 por médico / min) y correos de cambio de correo (5 por usuario / hora). Responde `429` con `Retry-After`.
  - Si la app queda detrás de un proxy (nginx, Cloudflare), define `TRUST_PROXY=true` para usar la IP real de `X-Forwarded-For`.
  - Si se escala a varias instancias, mover el conteo a Redis o MongoDB.
- [x] Cambiar el correo desde el perfil ya pide confirmarlo: se envía un enlace al correo nuevo (`/api/auth/confirmar-correo`, válido 24 h) y un aviso al anterior. Hasta confirmar se sigue usando el correo anterior; el cambio se puede cancelar desde el perfil.
- [x] **"Recordarme"**: pacientes, sesión de 30 días; sin marcarla, la cookie se borra al cerrar el navegador (JWT de 12 h). Los médicos no se ven afectados (siguen con 10 min de inactividad). El login con Google no marca "Recordarme".

### Recuperación de contraseña
- [x] El token del enlace se guarda como huella SHA-256 (quien lea la base no puede usar el enlace) y es de un solo uso, válido 1 hora.
- [x] `/nueva-contrasena` valida el enlace antes de mostrar el formulario y enseña los requisitos de la contraseña en vivo.
- [x] Al restablecer (o cambiar) la contraseña se cierran las sesiones abiertas en otros dispositivos (`sesionesDesde` en `User`) y se envía un correo de aviso.
- [x] Si el SMTP falla no se revela si la cuenta existe; el error queda en el log. En desarrollo sin SMTP, los correos se imprimen en la consola del servidor.
- [x] Probar el SMTP: `npm run email:prueba -- tu@correo.com` (en Docker: `docker compose exec app npm run email:prueba -- tu@correo.com`).

### Funcionalidad
- [x] Avisos por correo (`src/lib/notificaciones.ts`): al paciente cuando se le agenda, reagenda, reactiva o cancela una cita (también si se elimina una cita futura); al médico cuando el paciente confirma o cancela. Se envían en segundo plano: si el SMTP falla, la cita se guarda igual.
- [x] El paciente puede **confirmar** o **cancelar** (con motivo opcional) sus próximas citas desde su panel (`PUT /api/paciente/cita/[id]`). La cita guarda quién la canceló y el motivo, y el médico lo ve en su agenda.
- [x] Rutinas: botón **Editar** que reutiliza el formulario (nombre, objetivo, frecuencia y ejercicios). El paciente de la rutina no se puede cambiar.
- [x] Cuentas antiguas con contraseña que ya no cumple la regla: entran, pero se les lleva al perfil con un aviso para cambiarla.
- [ ] La zona horaria está fija en `America/Mexico_City` (`docker-compose.yml` y `src/middleware/index.ts`). Si habrá clínicas en otras zonas, guardarla por médico. **Pendiente:** requiere cambiar cómo se muestran todas las fechas (`src/components/dashboard/styles.ts`, formularios de citas y correos); conviene hacerlo solo cuando haya una clínica fuera de esa zona.

### Mantenimiento
- [ ] Instalar `@astrojs/check` y `typescript` como dependencias de desarrollo para revisar tipos con `npx astro check`.
- [ ] No hay pruebas automáticas. Lo mínimo: sesión única de médico, ciclo de vida de citas, asignación de pacientes.
- [ ] Hay muchos cambios sin commit. Además, buena parte de los archivos del repo aparecen modificados solo por saltos de línea (CRLF vs LF). Conviene añadir un `.gitattributes` con `* text=auto eol=lf` y hacer commit.
- [ ] Reiniciar el contenedor después de cambiar modelos de Mongoose: con HMR se queda el esquema anterior en memoria. **Necesario ahora:** `User` y `Cita` tienen campos nuevos.
