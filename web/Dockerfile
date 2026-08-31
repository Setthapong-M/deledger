FROM node:22.23.1-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/web/node_modules ./web/node_modules
COPY . .
RUN pnpm --dir web build

FROM node:22.23.1-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=80
WORKDIR /app
RUN groupadd --system --gid 1001 deledger && useradd --system --uid 1001 --gid deledger deledger
COPY --from=builder --chown=deledger:deledger /app/web/.next/standalone ./
COPY --from=builder --chown=deledger:deledger /app/web/.next/static ./web/.next/static
USER deledger
EXPOSE 80
CMD ["node", "web/server.js"]
