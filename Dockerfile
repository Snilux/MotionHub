# ──────────────────────────────────────────────────────────────
# MotionHub – Imagen de desarrollo
# Node 20 Alpine + Claude Code incluido
# ──────────────────────────────────────────────────────────────
FROM node:22-alpine

# Herramientas de sistema
RUN apk add --no-cache git curl bash openssh-client

# Claude Code global
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Instalar dependencias primero (mejor caché)
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Astro SSR corre en 4321
EXPOSE 4321

CMD ["npm", "run", "dev"]
