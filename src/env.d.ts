/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly MONGODB_URI: string;
  readonly JWT_SECRET: string;
  readonly SMTP_HOST: string;
  readonly SMTP_PORT: string;
  readonly SMTP_USER: string;
  readonly SMTP_PASS: string;
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    session: import("./lib/session").JWTPayload | null;
  }
}
