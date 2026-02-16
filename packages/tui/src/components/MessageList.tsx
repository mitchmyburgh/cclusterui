import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import type { Message } from "@mitchmyburgh/shared";

const marked = new Marked(markedTerminal() as any);

function renderMd(text: string): string {
  return (marked.parse(text) as string).trimEnd();
}

interface Props {
  messages: Message[];
  streamingText: string;
  status: string | null;
}

export function MessageList({ messages, streamingText, status }: Props) {
  const renderedStream = useMemo(
    () => (streamingText ? renderMd(streamingText) : ""),
    [streamingText]
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={1}>
          <Text bold color={msg.role === "user" ? "blue" : "green"}>
            {msg.role === "user" ? "You" : "Assistant"}:
          </Text>
          {msg.content.map((c, i) =>
            c.type === "text" ? (
              <Text key={i} wrap="wrap">
                {msg.role === "assistant" ? renderMd(c.text!) : c.text}
              </Text>
            ) : (
              <Text key={i} dimColor>
                [image]
              </Text>
            )
          )}
          {msg.metadata && (
            <Text dimColor>
              {[
                msg.metadata.model,
                msg.metadata.durationMs &&
                  `${(msg.metadata.durationMs / 1000).toFixed(1)}s`,
                msg.metadata.totalCostUsd &&
                  `$${msg.metadata.totalCostUsd.toFixed(4)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </Box>
      ))}

      {streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            Assistant:
          </Text>
          <Text wrap="wrap">{renderedStream}</Text>
        </Box>
      )}

      {status && status !== "idle" && (
        <Text dimColor>[{status}]</Text>
      )}
    </Box>
  );
}
