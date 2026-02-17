import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { FileSearchResult } from "@mitchmyburgh/shared";

interface Props {
  results: FileSearchResult[];
  loading: boolean;
  searchType: "filename" | "content";
  onSearch: (query: string, searchType: "filename" | "content") => void;
  onSelect: (result: FileSearchResult) => void;
  onClose: () => void;
}

export function FileSearchOverlay({ results, loading, searchType, onSearch, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentType, setCurrentType] = useState(searchType);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return && results.length > 0) {
      onSelect(results[selectedIndex]);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.tab) {
      const newType = currentType === "filename" ? "content" : "filename";
      setCurrentType(newType);
      if (query.trim()) onSearch(query.trim(), newType);
      return;
    }
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    if (value.trim()) {
      onSearch(value.trim(), currentType);
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="blue">File Search</Text>
        <Box gap={1}>
          <Text color={currentType === "filename" ? "blue" : "gray"}>[Files]</Text>
          <Text color={currentType === "content" ? "blue" : "gray"}>[Content]</Text>
        </Box>
      </Box>
      <Box marginY={1}>
        <Text bold color="blue">{"@ "}</Text>
        <TextInput value={query} onChange={handleQueryChange} placeholder="Search..." />
      </Box>
      {loading ? (
        <Text dimColor>Searching...</Text>
      ) : results.length === 0 ? (
        <Text dimColor>{query ? "No results" : "Type to search..."}</Text>
      ) : (
        <Box flexDirection="column">
          {results.slice(0, 10).map((result, idx) => (
            <Box key={`${result.path}-${result.lineNumber ?? idx}`}>
              <Text
                color={idx === selectedIndex ? "blue" : undefined}
                inverse={idx === selectedIndex}
              >
                {result.path}
                {result.lineNumber ? `:${result.lineNumber}` : ""}
                {result.lineContent ? ` - ${result.lineContent.substring(0, 60)}` : ""}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Tab switch  Enter select  Esc close</Text>
      </Box>
    </Box>
  );
}
