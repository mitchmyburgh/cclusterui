import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import type { FileSearchResult } from "@mitchmyburgh/shared";

interface FileSearchPopupProps {
  results: FileSearchResult[];
  loading: boolean;
  onSearch: (query: string, searchType: "filename" | "content") => void;
  onSelect: (result: FileSearchResult) => void;
  onClose: () => void;
}

export function FileSearchPopup({ results, loading, onSearch, onSelect, onClose }: FileSearchPopupProps) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"filename" | "content">("filename");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const doSearch = useCallback((q: string, type: "filename" | "content") => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q.trim()) onSearch(q.trim(), type);
    }, 300);
  }, [onSearch]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    doSearch(value, searchType);
  }, [searchType, doSearch]);

  const handleTabSwitch = useCallback((type: "filename" | "content") => {
    setSearchType(type);
    if (query.trim()) doSearch(query, type);
  }, [query, doSearch]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      onSelect(results[selectedIndex]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleTabSwitch(searchType === "filename" ? "content" : "filename");
    }
  }, [results, selectedIndex, onSelect, onClose, searchType, handleTabSwitch]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-hidden rounded-lg border border-gray-600 bg-gray-800 shadow-lg">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => handleTabSwitch("filename")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium ${
            searchType === "filename" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Files
        </button>
        <button
          onClick={() => handleTabSwitch("content")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium ${
            searchType === "content" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Content
        </button>
      </div>

      {/* Search input */}
      <div className="border-b border-gray-700 p-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={searchType === "filename" ? "Search files..." : "Search content..."}
          className="w-full rounded bg-gray-700 px-3 py-1.5 text-sm text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Results */}
      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500" />
          </div>
        ) : results.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-500">
            {query ? "No results found" : "Type to search..."}
          </div>
        ) : (
          results.map((result, idx) => (
            <button
              key={`${result.path}-${result.lineNumber ?? idx}`}
              onClick={() => onSelect(result)}
              className={`w-full px-3 py-1.5 text-left text-xs ${
                idx === selectedIndex ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div className="truncate font-mono">{result.path}</div>
              {result.type === "content_match" && result.lineNumber && (
                <div className="truncate text-[10px] text-gray-400">
                  L{result.lineNumber}: {result.lineContent}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
