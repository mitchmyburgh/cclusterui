# 01 - pnpm Workspace Setup

## Goal

Initialize the monorepo with pnpm workspaces, TypeScript base config, and all package scaffolds.

## Steps

### 1.1 Initialize root project

Create `package.json` at the repo root:

```json
{
  "name": "claude-chat",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 1.2 Create pnpm workspace file

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

### 1.3 Create root TypeScript config

Create `tsconfig.base.json` at root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### 1.4 Create .gitignore

```gitignore
node_modules/
dist/
.env
.env.local
*.tsbuildinfo
.turbo/
coverage/
```

### 1.5 Create .env.example

```env
# Comma-separated list of valid API keys
API_KEYS=sk-my-key-1,sk-my-key-2

# Anthropic API key for Claude Agent SDK
ANTHROPIC_API_KEY=your-anthropic-api-key

# Database driver: sqlite | postgres | mysql | mongodb
DB_DRIVER=sqlite

# SQLite (only when DB_DRIVER=sqlite)
SQLITE_PATH=./data/claude-chat.db

# PostgreSQL (only when DB_DRIVER=postgres)
POSTGRES_URL=postgresql://user:pass@localhost:5432/claude_chat

# MySQL (only when DB_DRIVER=mysql)
MYSQL_URL=mysql://user:pass@localhost:3306/claude_chat

# MongoDB (only when DB_DRIVER=mongodb)
MONGODB_URL=mongodb://localhost:27017/claude_chat

# Server
PORT=3000
HOST=0.0.0.0
```

### 1.6 Create package directories

```
packages/
  shared/
    src/
    package.json
    tsconfig.json
  db/
    src/
    package.json
    tsconfig.json
  client/
    src/
    .claude/            <-- Claude Agent SDK config dir
    package.json
    tsconfig.json
  server/
    src/
    package.json
    tsconfig.json
  ui/
    src/
    public/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
```

### 1.7 Initialize each package.json

Each package gets a `package.json` with:
- `name`: `@claude-chat/<package-name>`
- `type`: `"module"`
- `main`: `"dist/index.js"` (except ui)
- `types`: `"dist/index.d.ts"` (except ui)
- `scripts`: `dev`, `build`, `typecheck`

Example for `packages/shared/package.json`:

```json
{
  "name": "@claude-chat/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  }
}
```

### 1.8 Create per-package tsconfig.json

Each package extends root `tsconfig.base.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 1.9 Install root dev dependencies

```bash
pnpm add -Dw typescript @types/node
```

### 1.10 Verify workspace

Run `pnpm install` and verify all packages are linked:

```bash
pnpm ls --depth 0
```

## Output

- Monorepo skeleton with all 5 package directories
- Shared TypeScript configuration
- pnpm workspace linking working
- `.gitignore` and `.env.example` in place
