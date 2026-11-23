/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly JWT_SECRET: string;
  readonly SMTP_HOST: string;
  readonly SMTP_PORT: string;
  readonly SMTP_USER: string;
  readonly SMTP_PASS: string;
  readonly EMAIL_HOST: string;
  readonly EMAIL_PORT: string;
  readonly EMAIL_USER: string;
  readonly EMAIL_PASS: string;
  readonly PUBLIC_SITE_URL: string;
  readonly SITE_URL: string;
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: string;
  readonly TRUST_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    session: import("./lib/session").JWTPayload | null;
    // Solo médicos: ¿un administrador verificó su cédula? (lo fija el middleware)
    medicoVerificado?: boolean;
  }
}
