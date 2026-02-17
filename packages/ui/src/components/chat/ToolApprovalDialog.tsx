import { useState } from "react";
import type { ToolApprovalRequest } from "@mitchmyburgh/shared";

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  onRespond: (approved: boolean, alwaysAllow?: boolean) => void;
}

function formatToolInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== "object")
    return JSON.stringify(input, null, 2);
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case "Bash":
      return (obj.command as string) || JSON.stringify(input, null, 2);
    case "Write":
    case "Edit":
      return (obj.file_path as string) || JSON.stringify(input, null, 2);
    default:
      return JSON.stringify(input, null, 2);
  }
}

export function ToolApprovalDialog({
  request,
  onRespond,
}: ToolApprovalDialogProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = formatToolInput(request.toolName, request.toolInput);
  const fullInput = JSON.stringify(request.toolInput, null, 2);
  const isLong = fullInput.length > 200;

  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Approval Required
        </span>
        <span className="rounded bg-amber-100 dark:bg-amber-800/40 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-200">
          {request.toolName}
        </span>
      </div>

      <div className="mb-3">
        <pre className="max-h-40 overflow-auto rounded bg-gray-100 dark:bg-gray-800 p-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
          {expanded || !isLong ? fullInput : summary}
        </pre>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
          >
            {expanded ? "Show less" : "Show full input"}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onRespond(true)}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Allow
        </button>
        <button
          onClick={() => onRespond(true, true)}
          className="rounded bg-emerald-100 dark:bg-emerald-800/40 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-700 transition-colors"
        >
          Always Allow {request.toolName}
        </button>
        <button
          onClick={() => onRespond(false)}
          className="rounded bg-red-100 dark:bg-red-800/40 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
