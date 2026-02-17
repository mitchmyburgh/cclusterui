import type { Skill } from "@mitchmyburgh/shared";

interface SkillsPanelProps {
  skills: Skill[];
  onInvoke: (skillId: string) => void;
  onClose: () => void;
}

export function SkillsPanel({ skills, onInvoke, onClose }: SkillsPanelProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-medium text-gray-600">Skills</span>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Esc
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {skills.map((skill) => (
          <button
            key={skill.id}
            onClick={() => onInvoke(skill.id)}
            className="w-full px-3 py-2 text-left hover:bg-gray-50"
          >
            <div className="text-xs font-medium text-gray-900">
              {skill.name}
            </div>
            <div className="text-[10px] text-gray-500">{skill.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
