FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/server/package.json packages/server/
COPY packages/ui/package.json packages/ui/
COPY packages/client/package.json packages/client/
COPY packages/tui/package.json packages/tui/
RUN pnpm install --frozen-lockfile

# ── Build server + UI (shared & db are build deps) ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY packages/server packages/server
COPY packages/ui packages/ui
RUN pnpm --filter @mitchmyburgh/shared run build && \
    pnpm --filter @mitchmyburgh/db run build && \
    pnpm --filter @mitchmyburgh/server run build && \
    pnpm --filter @mitchmyburgh/ui run build

# ── Production image ──
FROM base AS runtime
ENV NODE_ENV=production

# Run as non-root user (H7)
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy workspace config and all package.json files for pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/server/package.json packages/server/
COPY packages/ui/package.json packages/ui/
COPY packages/client/package.json packages/client/
COPY packages/tui/package.json packages/tui/
RUN pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/ui/dist ./packages/ui/dist

# Create data directory and set ownership
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["node", "packages/server/dist/index.js"]
