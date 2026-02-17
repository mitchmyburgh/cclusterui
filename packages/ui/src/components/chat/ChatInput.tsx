import { useState, useRef, useCallback, type KeyboardEvent, type ClipboardEvent, type ChangeEvent } from "react";
import type { MessageContent, FileSearchResult, Skill } from "@mitchmyburgh/shared";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "@mitchmyburgh/shared";
import { FileSearchPopup } from "./FileSearchPopup";
import { SkillsPanel } from "./SkillsPanel";

interface ChatInputProps {
  onSend: (content: MessageContent[]) => void;
  disabled?: boolean;
  onCancel?: () => void;
  producerDisconnected?: boolean;
  chatId?: string;
  onFileSearch?: (query: string, searchType: "filename" | "content") => void;
  fileSearchResults?: FileSearchResult[];
  fileSearchLoading?: boolean;
  skills?: Skill[];
  onInvokeSkill?: (skillId: string) => void;
}

interface PendingImage {
  id: string;
  dataUrl: string;
  mimeType: string;
  name: string;
}

export function ChatInput({ onSend, disabled, onCancel, producerDisconnected, chatId, onFileSearch, fileSearchResults, fileSearchLoading, skills, onInvokeSkill }: ChatInputProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
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

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    // Detect @ trigger for file search
    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(^|\s)@(\S*)$/);
    if (atMatch && onFileSearch) {
      setShowFileSearch(true);
      setShowSkills(false);
    } else if (!atMatch && showFileSearch) {
      // Only close if there's no longer an @ trigger
      if (!textBeforeCursor.match(/(^|\s)@\S*$/)) {
        setShowFileSearch(false);
      }
    }
    // Detect / at start for skills
    if (value === "/" && skills && skills.length > 0) {
      setShowSkills(true);
      setShowFileSearch(false);
    } else if (showSkills && !value.startsWith("/")) {
      setShowSkills(false);
    }
  }, [onFileSearch, showFileSearch, showSkills, skills]);

  const handleFileSearchSelect = useCallback((result: FileSearchResult) => {
    const ref = result.lineNumber ? `@${result.path}#${result.lineNumber}` : `@${result.path}`;
    // Replace the @query portion with the selected reference
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const textBeforeCursor = text.substring(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx >= 0) {
      const newText = text.substring(0, atIdx) + ref + " " + text.substring(cursorPos);
      setText(newText);
    } else {
      setText(text + ref + " ");
    }
    setShowFileSearch(false);
    textareaRef.current?.focus();
  }, [text]);

  const handleSkillInvoke = useCallback((skillId: string) => {
    setShowSkills(false);
    setText("");
    onInvokeSkill?.(skillId);
  }, [onInvokeSkill]);

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
      if (!disabled && !producerDisconnected) handleSend();
    }
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  }, [disabled, producerDisconnected, handleSend, onCancel]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, []);

  const isSendDisabled = disabled || producerDisconnected;

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      {producerDisconnected && !disabled && (
        <div className="mb-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700 border border-amber-200">
          No local client connected. Run <code className="rounded bg-gray-100 px-1 text-gray-700">claude-chat-client --server &lt;url&gt; --chat {chatId || "<id>"} --anthropic-key &lt;key&gt;</code> to start.
        </div>
      )}
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
      <div className="relative flex items-end gap-2">
        {showFileSearch && onFileSearch && (
          <FileSearchPopup
            results={fileSearchResults ?? []}
            loading={fileSearchLoading ?? false}
            onSearch={onFileSearch}
            onSelect={handleFileSearchSelect}
            onClose={() => setShowFileSearch(false)}
          />
        )}
        {showSkills && skills && skills.length > 0 && (
          <SkillsPanel
            skills={skills}
            onInvoke={handleSkillInvoke}
            onClose={() => setShowSkills(false)}
          />
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Upload images"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        {skills && skills.length > 0 && (
          <button
            onClick={() => { setShowSkills(!showSkills); setShowFileSearch(false); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Skills"
            title="Skills"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        )}
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
          onChange={(e) => handleTextChange(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={producerDisconnected ? "No client connected..." : "Type a message..."}
          rows={1}
          disabled={isSendDisabled}
          className="flex-1 resize-none rounded-md bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 outline-none focus:ring-1 focus:ring-[#cb3837] focus:border-[#cb3837] disabled:opacity-50"
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
            disabled={isSendDisabled || (!text.trim() && images.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#cb3837] text-white hover:bg-[#b53130] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
