import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onPaste?: () => void;
}

export function Input({ onSubmit, disabled, placeholder, value: controlledValue, onChange, onPaste }: Props) {
  const [internalValue, setInternalValue] = React.useState("");

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const setValue = onChange || setInternalValue;

  useInput((input, key) => {
    if (key.return && value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
    // Detect Ctrl+V (character \x16)
    if (input === "\x16" && onPaste) {
      onPaste();
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
