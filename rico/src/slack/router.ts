import { randomUUID } from "node:crypto";
import type { Database } from "bun:sqlite";
import { enqueueQueuedRun, type QueueJob } from "../runtime/queue";
import { bootstrapSlackIntake } from "./intake";
import { verifySlackRequest } from "./signing";

interface SlackRouterOptions {
  db: Database;
  aiOpsChannelId: string;
  signingSecret: string;
  runIdFactory?: () => string;
  nowSeconds?: () => number;
  triggerDrain?: () => void | Promise<void>;
}

function parseJsonBody(rawBody: string) {
  return JSON.parse(rawBody || "{}") as Record<string, unknown>;
}

function parseSlackPayload(request: Request, rawBody: string) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload");
    if (payload) {
      return {
        kind: "interaction" as const,
        payload: JSON.parse(payload),
      };
    }

    return {
      kind: "command" as const,
      payload: Object.fromEntries(params.entries()),
    };
  }

  return {
    kind: "event" as const,
    payload: parseJsonBody(rawBody),
  };
}

export function createSlackRouter(options: SlackRouterOptions) {
  const runIdFactory = options.runIdFactory ?? (() => randomUUID());
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));

  return async function handleSlackRequest(request: Request) {
    const rawBody = await request.text();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = parseJsonBody(rawBody);
      if (body.type === "url_verification") {
        return Response.json({ challenge: body.challenge ?? "" });
      }
    }

    const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
    const signature = request.headers.get("x-slack-signature") ?? "";

    const verified = verifySlackRequest({
      signingSecret: options.signingSecret,
      rawBody,
      timestamp,
      signature,
      nowSeconds: nowSeconds(),
    });
    if (!verified) {
      return new Response("invalid signature", { status: 401 });
    }

    const { kind, payload } = parseSlackPayload(request, rawBody);
    const intakeResult = bootstrapSlackIntake(
      options.db,
      payload as Record<string, unknown>,
      {
        aiOpsChannelId: options.aiOpsChannelId,
        runIdFactory,
      },
    );
    let queued = false;
    if (intakeResult === null) {
      const job: QueueJob = {
        kind,
        payload,
        runId: runIdFactory(),
      };
      enqueueQueuedRun(options.db, job);
      queued = true;
    } else if (intakeResult === "handled") {
      queued = true;
    }
    if (queued && options.triggerDrain) {
      void options.triggerDrain();
    }

    return new Response("ok", { status: 200 });
  };
}
