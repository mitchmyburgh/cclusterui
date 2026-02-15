import { useState, useRef, useCallback, type KeyboardEvent, type ClipboardEvent, type ChangeEvent } from "react";
import type { MessageContent } from "@claude-chat/shared";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "@claude-chat/shared";

interface ChatInputProps {
  onSend: (content: MessageContent[]) => void;
  disabled?: boolean;
  onCancel?: () => void;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  mimeType: string;
  name: string;
}

export function ChatInput({ onSend, disabled, onCancel }: ChatInputProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImageFile = useCallback((file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return;
    if (file.size > MAX_IMAGE_SIZE) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), dataUrl: reader.result as string, mimeType: file.type, name: file.name },
      ]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    }
  }, [addImageFile]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(addImageFile);
    e.target.value = "";
  }, [addImageFile]);

  const handleSend = useCallback(() => {
    const content: MessageContent[] = [];
    const trimmed = text.trim();
    if (trimmed) content.push({ type: "text", text: trimmed });
    for (const img of images) {
      content.push({ type: "image", imageData: img.dataUrl, mimeType: img.mimeType });
    }
    if (content.length === 0) return;
    onSend(content);
    setText("");
    setImages([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, images, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) handleSend();
    }
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  }, [disabled, handleSend, onCancel]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, []);

  return (
    <div className="border-t border-gray-700 p-3">
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative">
              <img src={img.dataUrl} alt={img.name} className="h-16 w-16 rounded object-cover" />
              <button
                onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          aria-label="Upload images"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded-md bg-gray-700 px-4 py-2.5 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          aria-label="Type a message"
        />
        {disabled ? (
          <button
            onClick={onCancel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
            aria-label="Cancel"
          >
            ■
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && images.length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
