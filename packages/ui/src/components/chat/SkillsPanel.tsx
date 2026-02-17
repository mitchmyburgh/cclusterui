import type { Skill } from "@mitchmyburgh/shared";

interface SkillsPanelProps {
  skills: Skill[];
  onInvoke: (skillId: string) => void;
  onClose: () => void;
}

export function SkillsPanel({ skills, onInvoke, onClose }: SkillsPanelProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-hidden rounded-lg border border-gray-600 bg-gray-800 shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
        <span className="text-xs font-medium text-gray-300">Skills</span>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">Esc</button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {skills.map((skill) => (
          <button
            key={skill.id}
            onClick={() => onInvoke(skill.id)}
            className="w-full px-3 py-2 text-left hover:bg-gray-700"
          >
            <div className="text-xs font-medium text-white">{skill.name}</div>
            <div className="text-[10px] text-gray-400">{skill.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
