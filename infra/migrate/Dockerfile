FROM node:22.23.1-bookworm-slim
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends --yes openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile
COPY api/prisma api/prisma
COPY api/prisma.config.ts api/prisma.config.ts
COPY infra/migrate/run.mjs run.mjs
ENTRYPOINT ["node", "/app/run.mjs"]
