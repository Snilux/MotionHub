# 🏃 MotionHub – Plataforma de Fisioterapia

Aplicación web para gestión de fisioterapeutas y pacientes con autenticación por roles, rutas protegidas y MongoDB.

## 🗂️ Estructura del Proyecto

```
src/
├── lib/
│   ├── db.ts               # Conexión a MongoDB
│   ├── session.ts          # JWT – firmar/verificar/cookies
│   └── email.ts            # Nodemailer – recuperación de contraseña
├── models/
│   ├── User.ts             # Usuarios (médico y paciente)
│   ├── Cita.ts             # Citas / agenda
│   ├── Rutina.ts           # Rutinas de ejercicio
│   ├── Expediente.ts       # Expedientes clínicos
│   └── Progreso.ts         # Registro de sesiones
├── middleware.ts            # Protección de rutas por rol
├── pages/
│   ├── api/auth/           # login, register, logout, forgot/reset-password
│   ├── api/medico/         # citas, pacientes, rutinas, expediente
│   ├── api/paciente/       # citas, rutinas, progreso
│   ├── dashboard/medico/   # 🔒 Solo médicos
│   └── dashboard/paciente/ # 🔒 Solo pacientes
└── scripts/seed.js         # Datos de prueba
```

## ⚡ Instalación

```bash
npm install
cp .env.example .env   # Edita con tus valores
npm run seed           # Carga datos de prueba
npm run dev
```

## 🔑 Credenciales de prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Médico | medico@motionhub.com | medico123 |
| Médico 2 | ana@motionhub.com | medico123 |
| Paciente | paciente@motionhub.com | paciente123 |
| Paciente 2 | maria@motionhub.com | paciente123 |

## ➕ Agregar páginas

- Médico: `src/pages/dashboard/medico/nueva.astro`
- Paciente: `src/pages/dashboard/paciente/nueva.astro`
- Agrega el link en `src/components/common/DashboardLayout.astro`
