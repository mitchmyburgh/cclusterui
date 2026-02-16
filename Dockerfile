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
RUN pnpm install --frozen-lockfile

# ── Build everything ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY packages/server packages/server
COPY packages/ui packages/ui
RUN pnpm build

# ── Production image ──
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/package.json ./packages/server/
COPY --from=build /app/packages/ui/dist ./packages/ui/dist

COPY package.json pnpm-workspace.yaml ./

EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
