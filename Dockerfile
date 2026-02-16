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
RUN pnpm --filter @claude-chat/shared run build && \
    pnpm --filter @claude-chat/db run build && \
    pnpm --filter @claude-chat/server run build && \
    pnpm --filter @claude-chat/ui run build

# ── Production image ──
FROM base AS runtime
ENV NODE_ENV=production

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

EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
