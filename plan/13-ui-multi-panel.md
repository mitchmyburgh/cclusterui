# 13 - Multi-Panel Layout (Multiple Chats Open)

## Goal

Allow users to open multiple chats simultaneously in a side-by-side panel layout, similar to having multiple WhatsApp Web conversations visible at once.

## Steps

### 13.1 Design panel state management

Create `packages/ui/src/hooks/usePanels.ts`:

```typescript
// State:
//   openPanels: string[]  (array of chat IDs, order = left to right)
//   maxPanels: number      (computed from viewport width, default 3)

// Provides:
//   openChat(chatId: string): void
//     - If already open, focus/highlight it briefly
//     - If panels < maxPanels, add to end
//     - If panels >= maxPanels, replace the least recently focused one
//   closeChat(chatId: string): void
//     - Remove from openPanels
//   focusChat(chatId: string): void
//     - Track last focused for replacement logic
//   reorderPanels(fromIndex, toIndex): void
//     - Allow drag-to-reorder (stretch goal)
```

### 13.2 Update AppLayout for multi-panel

Update `packages/ui/src/components/layout/AppLayout.tsx`:

```
┌─────────────┬───────────────┬───────────────┬───────────────┐
│             │               │               │               │
│  Chat List  │  Chat Panel 1 │  Chat Panel 2 │  Chat Panel 3 │
│  Sidebar    │               │               │               │
│  (320px)    │  (flex: 1)    │  (flex: 1)    │  (flex: 1)    │
│             │               │               │               │
└─────────────┴───────────────┴───────────────┴───────────────┘
```

- Sidebar stays fixed at 320px
- Remaining space divided equally among open panels
- Each panel has a border-right separator (except last)
- If no panels open, show centered placeholder: "Select or create a chat"

### 13.3 Panel header with close button

Each `ChatPanel` header:
- Chat title (editable on double-click)
- Close (X) button
- Minimize/maximize toggle (optional stretch)

### 13.4 Handle panel resizing

- Panels share equal width by default (flex: 1)
- Optional: drag handle between panels for manual resize (stretch goal)
- When viewport is narrow (< 768px), show only 1 panel at a time with tab switching

### 13.5 Responsive behavior

```
Desktop (>= 1280px): up to 3 panels
Tablet (>= 768px):   up to 2 panels
Mobile (< 768px):    1 panel at a time (full-screen, swipe between)
```

On mobile:
- Sidebar is hidden behind hamburger menu
- Only one chat panel visible
- Swipe or tab bar to switch between open chats

### 13.6 Track active panels in URL (optional)

Store open panel IDs in URL query params so refreshing preserves layout:
```
/?panels=chat-id-1,chat-id-2,chat-id-3
```

Use `useSearchParams` from react-router-dom.

### 13.7 Panel lifecycle

Each `ChatPanel` instance:
- Maintains its own WebSocket connection
- Has independent message state (via `useChat` hook)
- Cleans up WebSocket on close
- Reconnects if the same chat is reopened

### 13.8 Visual indicators

- Active (focused) panel has a subtle border highlight
- Unread indicator: if a panel receives a message while user is looking at another, show a dot/badge
- Chat list items show "open" indicator for chats that have panels

### 13.9 Performance considerations

- Each open panel has its own WebSocket connection (acceptable for 3-4 panels)
- Lazy-load message history (don't fetch until panel is opened)
- Virtualize message list if chat has 100+ messages (use a library like `@tanstack/react-virtual`)

## Output

- Multiple chat panels displayed side-by-side
- Panel open/close/focus management
- Responsive layout for desktop/tablet/mobile
- Independent WebSocket per panel
- Active panel highlighting
- Smooth panel transitions
