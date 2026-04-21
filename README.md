#    MotionHub – Plataforma de Fisioterapia

Aplicación web para gestión de fisioterapeutas y pacientes con autenticación por roles, rutas protegidas y MongoDB.

##   Estructura del Proyecto

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
│   ├── dashboard/medico/   # Solo médicos
│   └── dashboard/paciente/ # Solo pacientes
└── scripts/seed.js         # Datos de prueba
```

## ⚡ Instalación

```bash
npm install
npm run seed           
npm run dev
```

##   Agregar páginas

- Médico: `src/pages/dashboard/medico/nueva.astro`
- Paciente: `src/pages/dashboard/paciente/nueva.astro`
- Agrega el link en `src/components/common/DashboardLayout.astro`
