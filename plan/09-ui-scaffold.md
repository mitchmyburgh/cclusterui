# 09 - Vite + React + PWA Scaffold

## Goal

Set up the `@claude-chat/ui` package with Vite, React 19, TypeScript, TailwindCSS, and basic app structure.

## Steps

### 9.1 Scaffold with Vite

```bash
cd packages
pnpm create vite ui --template react-ts
cd ui
```

### 9.2 Install additional dependencies

```bash
pnpm add @claude-chat/shared@workspace:*
pnpm add react-router-dom
pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

### 9.3 Configure Vite

Create/update `packages/ui/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Claude Chat",
        short_name: "Claude Chat",
        description: "Multi-chat AI assistant powered by Claude",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});
```

### 9.4 Set up TailwindCSS

Update `packages/ui/src/index.css`:

```css
@import "tailwindcss";
```

### 9.5 Create app directory structure

```
packages/ui/src/
  main.tsx              # React root + router
  App.tsx               # Top-level layout
  index.css             # Tailwind imports
  components/
    layout/
      AppLayout.tsx     # Main app shell (sidebar + content area)
    chat/
      ChatList.tsx      # WhatsApp-style chat list
      ChatListItem.tsx  # Single chat list item
      ChatPanel.tsx     # Chat message panel
      MessageBubble.tsx # Single message bubble
      ChatInput.tsx     # Message input with image paste
    auth/
      ApiKeyModal.tsx   # API key entry modal
    ui/
      Button.tsx        # Reusable button
      Input.tsx         # Reusable input
      Modal.tsx         # Reusable modal
      Spinner.tsx       # Loading spinner
  hooks/
    useAuth.ts          # API key management
    useChats.ts         # Chat list state
    useChat.ts          # Single chat state + WebSocket
    useWebSocket.ts     # WebSocket connection hook
  lib/
    api.ts              # REST API client (fetch wrapper)
    ws.ts               # WebSocket client
    storage.ts          # localStorage helpers
  types/
    index.ts            # UI-specific types (re-exports shared)
```

### 9.6 Create main.tsx with router

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

### 9.7 Create App.tsx with basic layout

```typescript
import { AppLayout } from "./components/layout/AppLayout";

function App() {
  return <AppLayout />;
}

export default App;
```

### 9.8 Create AppLayout placeholder

```typescript
export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-80 border-r border-gray-700">
        {/* ChatList goes here */}
        <p className="p-4">Chat list</p>
      </aside>
      <main className="flex-1">
        {/* ChatPanel(s) go here */}
        <p className="p-4">Select a chat</p>
      </main>
    </div>
  );
}
```

### 9.9 Create PWA icons

Add placeholder icons to `packages/ui/public/`:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `favicon.ico`

These can be simple colored squares initially and replaced with proper branding later.

### 9.10 Update index.html

Ensure `packages/ui/index.html` has:
- Correct viewport meta tag
- Theme color meta tag
- Title "Claude Chat"

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1a1a2e" />
    <title>Claude Chat</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 9.11 Add scripts to package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

### 9.12 Verify dev server starts

```bash
cd packages/ui && pnpm dev
# Should open at http://localhost:5173
# Should show basic layout with "Chat list" sidebar and "Select a chat" main area
```

## Output

- Vite dev server running with React + TypeScript
- TailwindCSS configured
- PWA plugin configured (manifest, service worker)
- Proxy to backend API configured
- Basic app shell layout rendering
- Directory structure for all future components
