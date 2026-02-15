# 15 - PWA Configuration

## Goal

Configure the UI as a Progressive Web App with manifest, service worker, offline support, and install prompt.

## Steps

### 15.1 PWA manifest (already in vite.config.ts)

Verify the VitePWA plugin config from step 09 includes:

```typescript
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Claude Chat",
    short_name: "Claude Chat",
    description: "Multi-chat AI assistant powered by Claude",
    theme_color: "#1a1a2e",
    background_color: "#1a1a2e",
    display: "standalone",
    orientation: "any",
    start_url: "/",
    scope: "/",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
})
```

### 15.2 Service worker strategy

Configure Workbox in VitePWA:

```typescript
workbox: {
  // Cache app shell (HTML, JS, CSS)
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

  // Runtime caching for API calls
  runtimeCaching: [
    {
      // Cache GET API responses (chat list, messages) with network-first
      urlPattern: /^\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
}
```

### 15.3 Offline fallback page

Create `packages/ui/public/offline.html`:

- Simple page saying "You're offline. Claude Chat requires an internet connection."
- Styled to match app theme
- "Retry" button that reloads the page

Configure VitePWA to serve this as offline fallback:

```typescript
workbox: {
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/api/],
}
```

### 15.4 Install prompt

Create `packages/ui/src/hooks/usePWAInstall.ts`:

```typescript
// Listen for "beforeinstallprompt" event
// Store the event
// Provide:
//   canInstall: boolean
//   promptInstall(): Promise<void>  -> trigger native install prompt
//   isInstalled: boolean  -> check if running in standalone mode
```

### 15.5 Install banner component

Create `packages/ui/src/components/ui/InstallBanner.tsx`:

- Shown at top of sidebar when `canInstall && !isInstalled`
- "Install Claude Chat for a better experience"
- "Install" button and "Dismiss" (X) button
- Dismissed state stored in localStorage (don't show again for 7 days)

### 15.6 Update meta tags in index.html

Ensure all PWA-required meta tags are present:

```html
<meta name="theme-color" content="#1a1a2e" />
<meta name="description" content="Multi-chat AI assistant powered by Claude" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### 15.7 Handle app updates

VitePWA `registerType: "autoUpdate"` handles this, but add a UI notification:

Create `packages/ui/src/hooks/useServiceWorker.ts`:

```typescript
// Register SW update handler
// When a new version is available:
//   Show toast: "A new version is available"
//   "Update" button -> call registration.update() and reload
```

### 15.8 Test PWA

1. Build production UI: `pnpm build`
2. Serve with `pnpm preview`
3. Open Chrome DevTools -> Application tab
4. Verify:
   - Manifest loads correctly
   - Service worker registered
   - App is installable
   - Offline mode shows cached shell
5. Test on mobile device via HTTPS (or localhost)

## Output

- PWA manifest with icons and theme
- Service worker with caching strategy
- Offline fallback page
- Install prompt/banner
- App update notifications
- Meets Chrome PWA installability criteria
