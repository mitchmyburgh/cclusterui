# 14 - Image Paste/Upload in Chat Input

## Goal

Allow users to paste images from clipboard or upload files, preview them, and send them alongside text messages.

## Steps

### 14.1 Create ChatInput component

Create `packages/ui/src/components/chat/ChatInput.tsx`:

Layout:
```
┌────────────────────────────────────────────┐
│  [Image previews row - if any]             │
│  ┌──────┐ ┌──────┐                        │
│  │ img1 │ │ img2 │  (thumbnails with X)    │
│  └──────┘ └──────┘                        │
├────────────────────────────────────────────┤
│  ┌──────┐ ┌──────────────────┐ ┌────────┐ │
│  │  📎  │ │ Type a message...│ │  Send  │ │
│  └──────┘ └──────────────────┘ └────────┘ │
└────────────────────────────────────────────┘
```

Props:
```typescript
interface ChatInputProps {
  onSend: (content: MessageContent[]) => void;
  disabled?: boolean;  // during streaming
  onCancel?: () => void;  // cancel button during streaming
}
```

### 14.2 Implement clipboard paste handler

```typescript
// On paste event in textarea:
// 1. Check clipboardData.items for image types
// 2. For each image item:
//    a. Get as File via item.getAsFile()
//    b. Validate: check mime type against ALLOWED_IMAGE_TYPES
//    c. Validate: check size against MAX_IMAGE_SIZE
//    d. Convert to base64 via FileReader.readAsDataURL()
//    e. Add to pendingImages state array
// 3. For text paste, let default behavior handle it
```

### 14.3 Implement file upload button

```typescript
// Hidden <input type="file" accept="image/*" multiple>
// Clip/attachment button triggers input.click()
// On change:
//   - Same validation as paste
//   - Same base64 conversion
//   - Add to pendingImages state
```

### 14.4 Implement drag-and-drop

```typescript
// On dragOver: show drop zone overlay on the input area
// On drop:
//   - Prevent default
//   - Get files from event.dataTransfer
//   - Filter for image types
//   - Same validation and conversion
//   - Add to pendingImages state
// On dragLeave: hide drop zone overlay
```

### 14.5 Image preview with removal

State: `pendingImages: Array<{ id: string; dataUrl: string; mimeType: string; name: string }>`

Display:
- Row of thumbnail previews above the text input
- Each thumbnail has an X button to remove
- Shows file name below thumbnail
- Subtle border/background for preview area
- If an image fails validation, show error toast (e.g., "Image too large (max 10MB)")

### 14.6 Build message content on send

When user clicks Send or presses Enter:

```typescript
function handleSend() {
  const content: MessageContent[] = [];

  // Add text if present
  const text = inputRef.current.value.trim();
  if (text) {
    content.push({ type: "text", text });
  }

  // Add images
  for (const img of pendingImages) {
    content.push({
      type: "image",
      imageData: img.dataUrl,
      mimeType: img.mimeType,
    });
  }

  if (content.length === 0) return;

  onSend(content);

  // Clear input and images
  inputRef.current.value = "";
  setPendingImages([]);
}
```

### 14.7 Keyboard shortcuts

- `Enter` -> Send message (if not empty)
- `Shift+Enter` -> New line in textarea
- `Escape` -> Cancel current streaming response (if active)
- `Ctrl+V` / `Cmd+V` -> Paste (images handled automatically)

### 14.8 Textarea auto-resize

- Start at 1 row height
- Grow as user types (up to max 6 rows)
- Shrink back when text is deleted
- Reset to 1 row after sending

```typescript
// On input event:
textarea.style.height = "auto";
textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
```

### 14.9 Send button state

- Disabled when input is empty AND no images pending
- Shows "Send" icon when ready
- Shows "Stop" icon during streaming (calls onCancel)
- Loading spinner while message is being sent

### 14.10 Accessibility

- Textarea has `aria-label="Type a message"`
- File input has `aria-label="Upload images"`
- Send button has `aria-label="Send message"`
- Image previews have `alt` text with filename
- Focus management: auto-focus textarea when panel opens

## Output

- Chat input with text area and image support
- Clipboard paste, file upload, and drag-and-drop for images
- Image preview with removal
- Auto-resizing textarea
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Proper disabled/loading states
- Accessible markup
