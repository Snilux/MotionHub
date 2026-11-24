# MotionHub – Plataforma de Fisioterapia

Aplicación web para que fisioterapeutas y pacientes gestionen citas, rutinas de ejercicio, progreso y expediente clínico. Tiene tres roles (fisioterapeuta, paciente y administrador) y se puede instalar en el celular como app (PWA).

**Tecnologías:** Astro 6 (SSR con Node) · MongoDB 7 · Tailwind CSS 4 · Docker.

Funciones principales:

- **Citas** con avisos por correo, confirmación y cancelación del paciente.
- **Rutinas** con videos de cada ejercicio, frecuencia (N veces al día, a la semana o al mes) y días fijos opcionales.
- **Registro de sesiones**: dolor antes y después, nota de texto o **nota de voz**, y límite por periodo.
- **Recordatorios diarios** a las 7:00, por correo y con **notificación push**.
- **Progreso**: el paciente ve su evolución y el fisioterapeuta, la de todos sus pacientes.
- **Expediente clínico**: el paciente sugiere cambios, el médico los aprueba y puede exportarlo a PDF.
- **Verificación de fisioterapeutas** (cédula profesional) por un administrador.

---

## Índice

1. [Requisitos](#1-requisitos)
2. [Instalación con Docker (recomendada)](#2-instalación-con-docker-recomendada)
3. [Datos de prueba y primer administrador](#3-datos-de-prueba-y-primer-administrador)
4. [Archivos subidos: fotos, videos y notas de voz](#4-archivos-subidos-fotos-videos-y-notas-de-voz)
5. [Recordatorios y notificaciones push](#5-recordatorios-y-notificaciones-push)
6. [Probar en el celular (HTTPS)](#6-probar-en-el-celular-https)
7. [Comandos útiles](#7-comandos-útiles)
8. [Solución de problemas](#8-solución-de-problemas)
9. [Instalación sin Docker](#9-instalación-sin-docker)
10. [Estructura del proyecto](#10-estructura-del-proyecto)

---

## 1. Requisitos

| Necesitas | Para qué |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine + Compose v2) | Corre la app, MongoDB y el servicio de recordatorios |
| [Git](https://git-scm.com/) | Clonar el repositorio |
| Una cuenta de correo con SMTP (p. ej. Gmail con *contraseña de aplicación*) | Enviar correos. **Opcional en desarrollo**: sin SMTP, los correos se imprimen en la consola |

En **Windows** usa Docker Desktop con **WSL 2** y clona el proyecto dentro de WSL (p. ej. `~/proyectos`), no en `C:\`. Desde `C:\` la recarga en caliente es muy lenta.

No hace falta instalar Node ni MongoDB en tu computadora: vienen dentro de los contenedores.

---

## 2. Instalación con Docker (recomendada)

### 2.1 Clonar el repositorio

```bash
git clone https://github.com/Snilux/MotionHub.git
cd MotionHub
```

### 2.2 Crear el archivo `.env`

Crea un archivo llamado `.env` en la raíz del proyecto, copia esta plantilla y llena los valores. Este archivo tiene contraseñas y **nunca se sube al repositorio** (está en `.gitignore`).

```ini
# ── Base de datos ───────────────────────────────────────────────
# Con Docker no se usa este valor: docker-compose.yml apunta al contenedor "mongo".
# Sirve para correr la app sin Docker (sección 9).
MONGODB_URI=mongodb://localhost:27017/motionhub

# ── Sesiones ────────────────────────────────────────────────────
# Mínimo 32 caracteres aleatorios. En producción la app no arranca sin él.
JWT_SECRET=

# ── Correo (SMTP) ── opcional en desarrollo ─────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu-cuenta@gmail.com
EMAIL_PASS=
EMAIL_FROM="MotionHub <tu-cuenta@gmail.com>"

# ── URL pública (enlaces de los correos y de Google) ────────────
SITE_URL=http://localhost:4321
PUBLIC_SITE_URL=http://localhost:4321

# ── Iniciar sesión con Google ── opcional (ver docs/PENDIENTES.md) ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Notificaciones push ─────────────────────────────────────────
# Genera las claves una sola vez (ver abajo). Si cambian, los usuarios
# tendrán que volver a activar las notificaciones en sus dispositivos.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
# Contacto del proyecto para los servicios de push (mailto: o https:)
VAPID_SUBJECT=mailto:contacto@tu-dominio.com

# ── Recordatorios diarios ───────────────────────────────────────
# Secreto que usa el servicio "cron" para llamar a la app (mínimo 16 caracteres).
CRON_SECRET=
```

**Generar los valores secretos.** No necesitas Node instalado: corre estos comandos con la imagen oficial de Node y pega cada resultado en su línea del `.env`.

```bash
# JWT_SECRET y CRON_SECRET (corre el comando dos veces, uno para cada uno)
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY
docker run --rm node:22-alpine npx -y web-push@3.6.7 generate-vapid-keys
```

**Gmail:** en `EMAIL_PASS` va una [contraseña de aplicación](https://myaccount.google.com/apppasswords), no tu contraseña normal. Requiere tener activada la verificación en dos pasos. Puedes pegarla con o sin espacios.

### 2.3 Levantar los contenedores

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos porque construye la imagen e instala las dependencias. Se levantan tres servicios:

| Servicio | Contenedor | Qué hace |
|---|---|---|
| `app` | `motionhub-dev` | La aplicación Astro en http://localhost:4321, con recarga en caliente: los cambios en el código se ven al instante |
| `mongo` | `motionhub-mongo` | MongoDB 7. Expuesto en `localhost:27017` para conectarte con MongoDB Compass |
| `cron` | `motionhub-cron` | Pide a la app que envíe los recordatorios todos los días a las 7:00 (hora de México) |

Revisa que todo esté arriba y mira el log de la app:

```bash
docker compose ps
docker compose logs -f app      # Ctrl + C para salir
```

Cuando aparezca `Local http://localhost:4321/`, abre esa dirección en el navegador.

---

## 3. Datos de prueba y primer administrador

### Datos de prueba (opcional)

```bash
docker compose exec app npm run seed
```

⚠️ **El seed borra todo**: usuarios, citas, rutinas, sesiones, y también las fotos, videos y notas de voz del volumen. Úsalo solo en desarrollo.

Crea estas cuentas, entre otras:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@motionhub.com` | `Motion2026Admin` |
| Fisioterapeuta (verificado) | `medico@motionhub.com` | `medico123` |
| Fisioterapeuta (pendiente de verificar) | `luis@motionhub.com` | `Medico1234` |
| Paciente | `paciente@motionhub.com` | `paciente123` |
| Otros médicos y pacientes | `*@motionhub.test` | `Prueba1234` |

Las cuentas con contraseña `medico123` o `paciente123` no cumplen la regla de contraseñas actual: sí pueden entrar, pero la app las lleva al perfil para que cambien la contraseña.

### Crear el primer administrador (sin seed)

```bash
docker compose exec app npm run admin:crear -- admin@tu-dominio.com "Nombre" "Apellido"
```

El comando imprime una **contraseña temporal** en la consola. Inicia sesión con ella y cámbiala desde el perfil. El administrador es quien aprueba a los fisioterapeutas que se registran.

### Probar el correo

```bash
docker compose exec app npm run email:prueba -- tu@correo.com
```

---

## 4. Archivos subidos: fotos, videos y notas de voz

Las **fotos de perfil**, los **videos de ejercicios** y las **notas de voz** se guardan en un **volumen de Docker** llamado `uploads-data`, montado en `/data/uploads` dentro del contenedor (variable `UPLOADS_DIR`):

```
/data/uploads/
├── avatars/     # fotos de perfil (JPG/PNG, máx. 2 MB)
├── videos/      # videos de ejercicios (MP4/MOV/WebM, máx. 100 MB)
└── notas-voz/   # notas de voz de las sesiones (máx. 3 min)
```

- En MongoDB solo se guarda la **ruta relativa** (p. ej. `videos/<id>-<fecha>-<aleatorio>.mp4`). Así se puede mover el volumen sin tocar la base.
- Los archivos **no son públicos**. Se sirven en `/archivos/...` solo con sesión iniciada:
  - un video lo ven solo el médico de la rutina y su paciente;
  - una nota de voz la escuchan solo el paciente y el médico de esa sesión.
- Los archivos que dejan de usarse se borran solos: al cambiar la foto, al quitar un video o al eliminar una rutina.
- El volumen **sobrevive** a `docker compose down` y a reconstruir la imagen. Solo se borra con `docker compose down -v` o `docker volume rm`.

### Respaldar y restaurar

En Docker Compose el volumen se llama `<carpeta-del-proyecto>_uploads-data`. Si clonaste en `MotionHub`, se llama `motionhub_uploads-data`. Confírmalo con `docker volume ls`.

```bash
# Respaldo de los archivos → uploads-AAAA-MM-DD.tar.gz en la carpeta actual
docker run --rm -v motionhub_uploads-data:/datos -v "$PWD":/respaldo alpine \
  tar czf /respaldo/uploads-$(date +%F).tar.gz -C /datos .

# Restaurar un respaldo
docker run --rm -v motionhub_uploads-data:/datos -v "$PWD":/respaldo alpine \
  tar xzf /respaldo/uploads-AAAA-MM-DD.tar.gz -C /datos

# Respaldo de la base de datos
docker compose exec mongo mongodump --db motionhub --archive > motionhub-$(date +%F).archive
# Restaurar la base de datos
docker compose exec -T mongo mongorestore --archive --drop < motionhub-AAAA-MM-DD.archive
```

Respalda siempre **los dos juntos** (archivos y base): la base apunta a los archivos.

---

## 5. Recordatorios y notificaciones push

Cada mañana a las **7:00 (hora de México)** el servicio `cron` llama a `POST /api/cron/recordatorios`. Cada paciente recibe **un solo aviso** con las rutinas que le tocan ese día, por **correo** y por **notificación push**. Si el job corre dos veces el mismo día, no se repite el envío.

Cuándo se le recuerda una rutina al paciente:

- **Con días fijos** (los elige el médico): en esos días.
- **Diaria o semanal sin días fijos**: mientras le falten sesiones del periodo.
- **Mensual sin días fijos**: los lunes y el día 1, si le faltan sesiones del mes.

**El paciente** activa las notificaciones en *Mis rutinas → Recordatorios*. Ahí mismo puede desactivar los correos.

En **iPhone**, las notificaciones solo funcionan con la app **instalada en la pantalla de inicio** (Compartir → «Agregar a inicio»), con iOS 16.4 o posterior.

**Ver a quién se le enviaría hoy, sin enviar nada:**

```bash
docker compose exec cron sh -c 'wget -qO- --post-data= --header "Authorization: Bearer $CRON_SECRET" "http://app:4321/api/cron/recordatorios?simular=1"'
```

**Enviar los recordatorios ahora** (solo se envían si hoy no se habían enviado): usa el mismo comando sin `?simular=1`.

Para cambiar la hora, edita la línea `0 7 * * *` del servicio `cron` en `docker-compose.yml` y corre `docker compose up -d cron`.

---

## 6. Probar en el celular (HTTPS)

El **micrófono** (notas de voz), las **notificaciones push** y la **instalación como app** solo funcionan con **HTTPS** o en `localhost`. Si abres la app desde el celular con `http://192.168.x.x:4321` cargará, pero esas funciones no estarán disponibles; la app avisa cuando falta la conexión segura.

Para probar en el celular, publica tu `localhost` con un túnel HTTPS, por ejemplo:

```bash
# Cloudflare Tunnel (sin cuenta, URL temporal)
docker run --rm -it --add-host=host.docker.internal:host-gateway \
  cloudflare/cloudflared tunnel --url http://host.docker.internal:4321

# o ngrok (requiere cuenta gratuita)
ngrok http 4321
```

Abre en el celular la URL `https://...` que te da el túnel. Pon esa misma URL en `SITE_URL` y `PUBLIC_SITE_URL` del `.env` para que los enlaces de los correos apunten ahí, y reinicia la app (`docker compose up -d app`).

Si Vite rechaza el dominio del túnel con «Blocked request. This host is not allowed», agrega `allowedHosts: true` dentro de `vite.server` en `astro.config.mjs` **solo mientras pruebas**.

---

## 7. Comandos útiles

| Acción | Comando |
|---|---|
| Levantar todo | `docker compose up -d` |
| Detener (conserva datos y archivos) | `docker compose down` |
| Ver logs de la app | `docker compose logs -f app` |
| Reiniciar la app (p. ej. tras cambiar `.env`) | `docker compose up -d app` |
| Reconstruir tras cambiar `package.json` o el `Dockerfile` | `docker compose up -d --build` |
| Instalar una dependencia nueva | `docker compose exec app npm install <paquete>` |
| Abrir una terminal en la app | `docker compose exec app sh` |
| Consola de MongoDB | `docker compose exec mongo mongosh motionhub` |
| Datos de prueba (⚠️ borra todo) | `docker compose exec app npm run seed` |
| **Borrar todo, incluidos datos y archivos** | `docker compose down -v` ⚠️ |

---

## 8. Solución de problemas

**La app no arranca o el puerto 4321 / 27017 está ocupado.**
Otro programa usa ese puerto: detén el MongoDB local o cambia el puerto de la izquierda en `docker-compose.yml` (p. ej. `"4322:4321"`).

**Cambié el `.env` y no se nota.**
Los contenedores leen el `.env` al crearse. Ejecuta `docker compose up -d` (recrea los que cambiaron).

**Las sesiones fallan o me saca al iniciar sesión después de cambiar `JWT_SECRET`.**
Es normal: las sesiones firmadas con el secreto anterior dejan de valer. Vuelve a iniciar sesión. Si el problema sigue después de un `docker compose up`, revisa que el `JWT_SECRET` del `.env` sea el que esperas.

**Los correos no llegan.**
Prueba el SMTP con `docker compose exec app npm run email:prueba -- tu@correo.com`. Sin `EMAIL_USER` y `EMAIL_PASS`, en desarrollo los correos se imprimen en `docker compose logs app`.

**«Las notificaciones aún no están configuradas en el servidor».**
Faltan `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en el `.env` (sección 2.2). Después reinicia con `docker compose up -d`.

**No aparece el botón para grabar o activar notificaciones en el celular.**
Falta HTTPS (sección 6). En iPhone, además, la app debe estar instalada en la pantalla de inicio.

**Se negó el permiso del micrófono o de las notificaciones.**
El navegador ya no vuelve a preguntar. La app muestra cómo reactivarlo según el dispositivo: ajustes del sitio en el navegador, o *Ajustes → MotionHub* en el celular.

**En Windows la recarga en caliente no detecta cambios o va lenta.**
Clona el proyecto dentro de WSL, no en `C:\`. Docker ya está configurado con *polling* para detectar cambios en volúmenes montados.

**Todos los archivos aparecen como modificados en Git.**
Es por los saltos de línea de Windows (CRLF). Configura tu editor para usar LF en este proyecto.

---

## 9. Instalación sin Docker

Solo si no puedes usar Docker. Necesitas **Node 22+** y **MongoDB 7** corriendo en tu computadora.

```bash
npm install
# .env igual que en la sección 2.2; MONGODB_URI apuntando a tu MongoDB local
npm run seed        # opcional, ⚠️ borra todo
npm run dev         # http://localhost:4321
```

Sin Docker:

- Los archivos subidos se guardan en la carpeta `./uploads` del proyecto (ignorada por Git). Para usar otra, define `UPLOADS_DIR`.
- No hay servicio `cron`. Para enviar los recordatorios, programa en tu sistema una llamada diaria:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:4321/api/cron/recordatorios
```

---

## 10. Estructura del proyecto

```
├── docker-compose.yml       # app + mongo + cron, volúmenes mongo-data y uploads-data
├── Dockerfile               # imagen de desarrollo (Node 22)
├── public/
│   ├── manifest.webmanifest # PWA
│   └── sw.js                # service worker: caché, página sin conexión y notificaciones push
├── docs/PENDIENTES.md       # configuración de Google y recomendaciones
└── src/
    ├── middleware/          # sesión, roles y verificación de médicos en cada petición
    ├── lib/
    │   ├── db.ts            # conexión a MongoDB
    │   ├── session.ts       # JWT y cookies de sesión
    │   ├── email.ts         # plantillas y envío de correos
    │   ├── storage.ts       # volumen de subidas: guardar, leer y borrar archivos
    │   ├── frecuencia.ts    # reglas de las rutinas: días, límite por periodo, recordatorios
    │   ├── recordatorios.ts # job diario de recordatorios
    │   ├── push.ts          # notificaciones push (web-push / VAPID)
    │   └── modelo.ts        # registra modelos de Mongoose (recarga en caliente)
    ├── models/              # User, Cita, Rutina, Progreso, Expediente, SolicitudExpediente, PushSuscripcion
    ├── pages/
    │   ├── api/             # auth, medico, paciente, admin, perfil, push, cron
    │   ├── archivos/        # entrega privada de fotos, videos y notas de voz
    │   └── dashboard/       # medico/, paciente/, admin/
    ├── components/          # layout del dashboard, gráficas y componentes comunes
    └── scripts/
        ├── ui.ts            # alertas, confirmaciones, modales y llamadas a la API
        ├── notaVoz.ts       # grabadora de notas de voz
        ├── push.ts          # activar o desactivar notificaciones en el dispositivo
        ├── seed.js          # datos de prueba
        └── crear-admin.js   # primer administrador
```

### Agregar una página al dashboard

1. Crea el archivo en `src/pages/dashboard/<rol>/nueva.astro` usando `DashboardLayout` y `PageHeader` (copia una página existente como base).
2. Agrega el enlace al menú en `src/components/common/DashboardLayout.astro`.
3. El middleware protege la ruta por rol automáticamente.
