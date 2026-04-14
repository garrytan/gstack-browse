import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRoleContext } from "../memory/context-loader";
import { loadOpenClawContextArtifacts } from "../memory/openclaw-context";
import { MemoryStore } from "../memory/store";
import { resolveProjectWorkspace } from "../orchestrator/project-workspace";
import type {
  CaptainConversationDecision,
  CaptainConversationInput,
  GovernorConversationInput,
  GovernorConversationReply,
} from "../slack/conversation-gate";

const FILESYSTEM_BOUNDARY =
  "IMPORTANT: Do NOT read or execute any files under ~/.claude/, ~/.agents/, or .claude/skills/. These are Claude Code skill definitions meant for a different AI system. Stay focused on repository code only.";

function emptyCodexSandbox() {
  const sandbox = join(tmpdir(), "rico-conversation-sandbox");
  mkdirSync(sandbox, { recursive: true });
  return sandbox;
}

function pruneMemory(memory: Record<string, string>, limit = 12) {
  return Object.fromEntries(Object.entries(memory).slice(0, limit));
}

async function readText(stream: ReadableStream<Uint8Array> | null | undefined) {
  if (!stream) return "";
  return await new Response(stream).text();
}

async function runCodexPrompt(input: {
  cwd: string;
  prompt: string;
  timeoutMs?: number;
}) {
  const proc = Bun.spawn([
    "codex",
    "exec",
    input.prompt,
    "-C",
    input.cwd,
    "-s",
    "danger-full-access",
    "-c",
    'model_reasoning_effort="medium"',
    "--skip-git-repo-check",
    "--json",
  ], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    cwd: input.cwd,
  });

  const killTimer = setTimeout(() => {
    try {
      proc.kill();
    } catch {
      // ignore cleanup errors
    }
  }, input.timeoutMs ?? 60_000);

  const [stdout, stderr, exitCode] = await Promise.all([
    readText(proc.stdout),
    readText(proc.stderr),
    proc.exited,
  ]);
  clearTimeout(killTimer);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `codex exited with status ${exitCode}`);
  }

  let agentText = "";
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      if (event.type === "item.completed" && event.item && typeof event.item === "object") {
        const item = event.item as Record<string, unknown>;
        if (item.type === "agent_message" && typeof item.text === "string") {
          agentText += `${item.text}\n`;
        }
      }
    } catch {
      // ignore malformed codex events
    }
  }

  if (!agentText.trim()) {
    throw new Error("Codex returned no conversation message");
  }

  return agentText.trim();
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Codex conversation response was not valid JSON");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function buildGovernorPrompt(input: {
  message: string;
  knownProjects: string[];
}) {
  return [
    FILESYSTEM_BOUNDARY,
    "",
    "You are the Governor in a Slack-based multi-agent engineering runtime.",
    "The message is from the #total channel. This is a lightweight coordination/discussion turn, not an execution round.",
    "Reply directly as the Governor. Do not create tasks, do not break work down, and do not pretend work already started.",
    "If the user is asking for real execution but has not scoped it clearly, say that briefly and tell them what project or project channel to use.",
    "Keep it short, human, and practical. 2-5 lines max. Answer in Korean.",
    "Return exactly one JSON object and nothing else.",
    "",
    "JSON schema:",
    '{"reply":"총괄: ..."}',
    "",
    `known_projects=${input.knownProjects.join(", ") || "none"}`,
    `message=${input.message}`,
  ].join("\n");
}

function buildCaptainPrompt(input: {
  projectId: string;
  message: string;
  threadGoalTitle?: string | null;
  workspacePath: string | null;
  memoryStore?: MemoryStore;
  openclawWorkspacePath?: string | null;
}) {
  const projectMemory = input.memoryStore
    ? pruneMemory(input.memoryStore.getSharedProjectMemory(input.projectId))
    : {};
  const roleMemory = input.memoryStore
    ? {
        planner: pruneMemory(input.memoryStore.getRoleProjectMemory(input.projectId, "planner"), 6),
        designer: pruneMemory(input.memoryStore.getRoleProjectMemory(input.projectId, "designer"), 6),
        frontend: pruneMemory(input.memoryStore.getRoleProjectMemory(input.projectId, "frontend"), 6),
        backend: pruneMemory(input.memoryStore.getRoleProjectMemory(input.projectId, "backend"), 6),
        qa: pruneMemory(input.memoryStore.getRoleProjectMemory(input.projectId, "qa"), 6),
        customerVoice: pruneMemory(input.memoryStore.getRoleProjectMemory(input.projectId, "customer-voice"), 6),
      }
    : {};

  const context = buildRoleContext({
    role: "captain",
    goalSummary: [
      `project_id=${input.projectId}`,
      `thread_goal=${input.threadGoalTitle ?? "none"}`,
      `workspace=${input.workspacePath ?? "unresolved"}`,
      `message=${input.message}`,
    ].join("\n"),
    artifacts: [
      { title: "project-memory.json", body: JSON.stringify(projectMemory, null, 2) },
      { title: "role-memory.json", body: JSON.stringify(roleMemory, null, 2) },
      ...loadOpenClawContextArtifacts({
        workspacePath: input.openclawWorkspacePath,
        repoPath: input.workspacePath,
      }),
    ],
    maxChars: 5000,
  });

  const workspaceInstruction = input.workspacePath
    ? `You may inspect the workspace at ${input.workspacePath}, but only if needed for a direct answer.`
    : "No workspace was resolved. Answer from the message and stored context only.";

  return [
    FILESYSTEM_BOUNDARY,
    "",
    "You are the Project Captain in a Slack-based multi-agent engineering runtime.",
    "Your job is to decide whether this message should be answered directly in conversation or turned into an execution round.",
    workspaceInstruction,
    "Choose mode=reply for: clarification, feedback, tradeoff discussion, explaining why a role responded, interpreting current status, or lightweight product discussion.",
    "Choose mode=delegate for: actual implementation, repo inspection, QA verification, structured specialist work, or anything that should become a tracked run.",
    "Do not create tasks here. Just decide reply vs delegate.",
    "If mode=reply, write a short human response as the Captain. 2-5 lines max. Answer in Korean.",
    "If mode=delegate, explain the reason briefly in delegateReason and keep reply empty or very short.",
    "Return exactly one JSON object and nothing else.",
    "",
    "JSON schema:",
    '{"mode":"reply|delegate","reply":"캡틴: ...","delegateReason":null}',
    "",
    "Context:",
    context,
  ].join("\n");
}

function parseGovernorConversation(text: string): GovernorConversationReply {
  const parsed = extractJsonObject(text);
  if (typeof parsed.reply !== "string" || parsed.reply.trim().length === 0) {
    throw new Error("Codex governor conversation response was not valid JSON");
  }
  return { reply: parsed.reply.trim() };
}

function parseCaptainConversation(text: string): CaptainConversationDecision {
  const parsed = extractJsonObject(text);
  if (
    (parsed.mode !== "reply" && parsed.mode !== "delegate")
    || typeof parsed.reply !== "string"
  ) {
    throw new Error("Codex captain conversation response was not valid JSON");
  }
  return {
    mode: parsed.mode,
    reply: parsed.reply.trim(),
    delegateReason:
      parsed.delegateReason == null
        ? null
        : typeof parsed.delegateReason === "string"
          ? parsed.delegateReason.trim()
          : null,
  };
}

export function createCodexGovernorConversationExecutor(input: {
  timeoutMs?: number;
} = {}) {
  return async function executeGovernorConversation(
    conversation: GovernorConversationInput,
  ): Promise<GovernorConversationReply> {
    const text = await runCodexPrompt({
      cwd: emptyCodexSandbox(),
      prompt: buildGovernorPrompt({
        message: conversation.text,
        knownProjects: conversation.knownProjects,
      }),
      timeoutMs: input.timeoutMs,
    });
    return parseGovernorConversation(text);
  };
}

export function createCodexCaptainConversationExecutor(input: {
  timeoutMs?: number;
  openclawWorkspacePath?: string;
} = {}) {
  return async function executeCaptainConversation(
    conversation: CaptainConversationInput & {
      memoryStore?: MemoryStore;
    },
  ): Promise<CaptainConversationDecision> {
    const workspacePath = resolveProjectWorkspace({
      projectId: conversation.projectId,
      memoryStore: conversation.memoryStore,
    });
    const text = await runCodexPrompt({
      cwd: workspacePath ?? emptyCodexSandbox(),
      prompt: buildCaptainPrompt({
        projectId: conversation.projectId,
        message: conversation.text,
        threadGoalTitle: conversation.threadGoalTitle,
        workspacePath,
        memoryStore: conversation.memoryStore,
        openclawWorkspacePath: input.openclawWorkspacePath,
      }),
      timeoutMs: input.timeoutMs,
    });
    return parseCaptainConversation(text);
  };
}
