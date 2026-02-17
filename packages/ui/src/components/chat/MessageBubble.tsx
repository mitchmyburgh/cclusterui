import ReactMarkdown from "react-markdown";
import type { Message } from "@mitchmyburgh/shared";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-[#cb3837] text-white"
            : "bg-gray-50 text-gray-900 border border-gray-100"
        }`}
      >
        {message.content.map((block, i) => {
          if (block.type === "text" && block.text) {
            if (isUser) {
              return (
                <div key={i} className="whitespace-pre-wrap break-words text-sm">
                  {block.text}
                </div>
              );
            }
            return (
              <div key={i} className="prose prose-sm max-w-none break-words">
                <ReactMarkdown>{block.text}</ReactMarkdown>
              </div>
            );
          }
          if (block.type === "image" && block.imageData) {
            return (
              <img
                key={i}
                src={block.imageData}
                alt="Uploaded"
                className="mt-1 max-h-64 rounded"
              />
            );
          }
          return null;
        })}
        {message.metadata && (
          <div className="mt-1 text-[10px] text-gray-400">
            {message.metadata.model && <span>{message.metadata.model}</span>}
            {message.metadata.durationMs && <span> · {(message.metadata.durationMs / 1000).toFixed(1)}s</span>}
            {message.metadata.totalCostUsd != null && <span> · ${message.metadata.totalCostUsd.toFixed(4)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
