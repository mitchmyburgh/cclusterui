import React from "react";
import { Box, Text } from "ink";
import type { Message } from "@claude-chat/shared";

interface Props {
  messages: Message[];
  streamingText: string;
  status: string | null;
}

export function MessageList({ messages, streamingText, status }: Props) {
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
                {c.text}
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
          <Text wrap="wrap">{streamingText}</Text>
        </Box>
      )}

      {status && status !== "idle" && (
        <Text dimColor>[{status}]</Text>
      )}
    </Box>
  );
}
