import type { Skill } from "@mitchmyburgh/shared";

interface SkillDefinition extends Skill {
  prompt: string;
}

const BUILT_IN_SKILLS: SkillDefinition[] = [
  {
    id: "commit",
    name: "Commit",
    description: "Create a git commit with a meaningful message",
    prompt: "Review all staged and unstaged changes, then create a git commit with a clear, descriptive commit message that follows conventional commit conventions.",
  },
  {
    id: "review-pr",
    name: "Review PR",
    description: "Review the current branch changes as a pull request",
    prompt: "Review all changes on the current branch compared to the base branch. Provide a thorough code review covering: code quality, potential bugs, security issues, performance concerns, and suggested improvements.",
  },
  {
    id: "explain",
    name: "Explain",
    description: "Explain the current codebase structure and architecture",
    prompt: "Analyze the current project directory and explain the codebase structure, key files, architecture patterns, and how the main components fit together. Provide a high-level overview suitable for a new developer.",
  },
  {
    id: "test",
    name: "Test",
    description: "Run tests and analyze results",
    prompt: "Find and run the project's test suite. Analyze the results, report any failures, and suggest fixes for failing tests.",
  },
  {
    id: "fix-lint",
    name: "Fix Lint",
    description: "Find and fix linting and type errors",
    prompt: "Run the project's linting and type checking tools. Fix any errors or warnings found. If there are too many issues, prioritize the most critical ones.",
  },
];

export function getSkillList(): Skill[] {
  return BUILT_IN_SKILLS.map(({ id, name, description }) => ({ id, name, description }));
}

export function getSkillById(id: string): SkillDefinition | undefined {
  return BUILT_IN_SKILLS.find((s) => s.id === id);
}
