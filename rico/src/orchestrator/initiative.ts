import {
  INITIATIVE_PHASE_SIZE,
  MAX_DIRECT_GOAL_TASKS,
} from "./policies";

export function splitOversizedGoal(input: {
  projectId: string;
  title: string;
  tasks: string[];
}) {
  if (input.tasks.length <= MAX_DIRECT_GOAL_TASKS) {
    return { kind: "goal" as const, goals: [] };
  }

  const goals: Array<{ title: string; tasks: string[] }> = [];
  for (let index = 0; index < input.tasks.length; index += INITIATIVE_PHASE_SIZE) {
    goals.push({
      title: `${input.title} / phase ${goals.length + 1}`,
      tasks: input.tasks.slice(index, index + INITIATIVE_PHASE_SIZE),
    });
  }

  return {
    kind: "initiative" as const,
    goals,
  };
}
