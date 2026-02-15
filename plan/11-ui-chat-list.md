# 11 - Chat List Sidebar (WhatsApp-Style)

## Goal

Build the left sidebar showing all chats in a scrollable list, with new chat button, search, and active state.

## Steps

### 11.1 Create useChats hook

Create `packages/ui/src/hooks/useChats.ts`:

```typescript
// State:
//   chats: Chat[]
//   loading: boolean
//   error: string | null

// On mount: fetch GET /api/chats -> populate chats
// Provides:
//   createChat(): POST /api/chats -> add to list, return new chat
//   deleteChat(id): DELETE /api/chats/:id -> remove from list
//   updateChat(id, input): PATCH /api/chats/:id -> update in list
//   refreshChats(): re-fetch list
//   chats, loading, error
```

### 11.2 Create ChatList component

Create `packages/ui/src/components/chat/ChatList.tsx`:

Layout (WhatsApp Web inspired):
- Fixed header bar at top:
  - App name/logo on left
  - "New Chat" button (+ icon) on right
  - Settings/logout button
- Search input below header (filters chats by title client-side)
- Scrollable list of `ChatListItem` components below
- Empty state: "No chats yet. Create one to get started."

Props:
```typescript
interface ChatListProps {
  chats: Chat[];
  activeChatIds: string[];    // currently open chats (highlighted)
  onSelectChat: (id: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (id: string) => void;
}
```

### 11.3 Create ChatListItem component

Create `packages/ui/src/components/chat/ChatListItem.tsx`:

- Displays chat title (truncated if long)
- Shows last message preview (first ~60 chars) if available
- Shows relative timestamp (e.g., "2m ago", "Yesterday")
- Highlighted background when active (in `activeChatIds`)
- Click handler calls `onSelectChat`
- Right-click or "..." menu with "Delete" option
- Hover state with subtle background change

Props:
```typescript
interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  lastMessagePreview?: string;
  onSelect: () => void;
  onDelete: () => void;
}
```

### 11.4 Implement search/filter

- Controlled input at top of list
- Filters `chats` array by title (case-insensitive includes)
- Shows "No results" if filter matches nothing
- Clear button (x) to reset search

### 11.5 Implement new chat creation flow

When "New Chat" is clicked:
1. Call `createChat()` from useChats hook
2. This POSTs to `/api/chats` with default title
3. Add returned chat to list
4. Auto-select (open) the new chat
5. Focus the message input in the new chat panel

### 11.6 Implement chat deletion

When delete is confirmed:
1. Show confirmation prompt ("Delete this chat?")
2. Call `deleteChat(id)` from useChats hook
3. Remove from list
4. If deleted chat was active, close its panel

### 11.7 Style the sidebar

- Width: 320px (w-80)
- Dark background matching WhatsApp Web dark theme
- Border-right separator
- Scrollbar styled for dark theme
- Responsive: collapsible on mobile (hamburger menu)

### 11.8 Chat ordering

- Chats ordered by `updatedAt` descending (most recent first)
- When a new message is sent/received, that chat moves to top

## Output

- Sidebar showing list of all chats
- Create new chat functionality
- Delete chat with confirmation
- Search/filter chats
- Active chat highlighting
- WhatsApp Web-inspired visual design
