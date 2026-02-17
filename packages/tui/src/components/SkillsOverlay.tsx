import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Skill } from "@mitchmyburgh/shared";

interface Props {
  skills: Skill[];
  onInvoke: (skillId: string) => void;
  onClose: () => void;
}

export function SkillsOverlay({ skills, onInvoke, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return && skills.length > 0) {
      onInvoke(skills[selectedIndex].id);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, skills.length - 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Text bold color="yellow">
        Skills
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {skills.map((skill, idx) => (
          <Box key={skill.id} gap={1}>
            <Text
              color={idx === selectedIndex ? "yellow" : undefined}
              inverse={idx === selectedIndex}
            >
              {skill.name}
            </Text>
            <Text dimColor>- {skill.description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter invoke Esc close</Text>
      </Box>
    </Box>
  );
}
