import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function Input({ onSubmit, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (key.return && value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
  });

  return (
    <Box borderStyle="single" borderColor={disabled ? "gray" : "blue"} paddingX={1}>
      {disabled ? (
        <Text dimColor>Waiting for response...</Text>
      ) : (
        <>
          <Text bold color="blue">
            {">"}{" "}
          </Text>
          <TextInput
            value={value}
            onChange={setValue}
            placeholder={placeholder ?? "Type a message..."}
          />
        </>
      )}
    </Box>
  );
}
