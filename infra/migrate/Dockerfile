FROM node:22.23.1-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --prod
COPY db/migrations db/migrations
COPY infra/migrate/run.mjs run.mjs
ENTRYPOINT ["node", "/app/run.mjs"]
