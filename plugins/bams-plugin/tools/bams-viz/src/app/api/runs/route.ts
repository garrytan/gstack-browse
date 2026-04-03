/**
 * bams-viz/src/app/api/runs/route.ts
 *
 * 실시간 실행 뷰어 API 라우트
 * PRD §2.7: C2 실시간 실행 뷰어
 *
 * GET /api/runs         — 실행 목록 (bams-server에서 프록시)
 * GET /api/runs/stream  — SSE 스트리밍 (bams-server /api/events/stream 프록시)
 */

import type { NextRequest } from "next/server";
import { EventStore } from "@/lib/event-store";

const BAMS_SERVER = process.env.BAMS_SERVER_URL ?? "http://localhost:3099";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const pipeline = searchParams.get("pipeline");
  const agent = searchParams.get("agent");
  const stream = searchParams.get("stream");

  // SSE 스트리밍 프록시
  if (stream === "1") {
    const qs = new URLSearchParams();
    if (pipeline) qs.set("pipeline", pipeline);
    if (agent) qs.set("agent", agent);

    try {
      const upstream = await fetch(
        `${BAMS_SERVER}/api/events/stream?${qs.toString()}`,
        {
          headers: { Accept: "text/event-stream" },
          // @ts-expect-error — Next.js fetch 확장
          duplex: "half",
        }
      );

      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      const errorStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue(
            `event: error\ndata: ${JSON.stringify({
              message: "bams-server (http://localhost:3099) not running. Start with: bun run plugins/bams-plugin/server/src/app.ts",
            })}\n\n`
          );
          controller.close();
        },
      });
      return new Response(errorStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
  }

  // 실행 로그 목록 프록시
  if (pipeline) {
    const limit = searchParams.get("limit") ?? "100";
    try {
      const res = await fetch(
        `${BAMS_SERVER}/api/runs/${pipeline}/logs?limit=${limit}`
      );
      const data = await res.json();
      return Response.json(data, { headers: { "X-Data-Source": "api" } });
    } catch {
      try {
        const store = EventStore.getInstance();
        const events = store.getRawEvents(pipeline);
        return Response.json(
          { logs: events, count: events.length },
          { headers: { "X-Data-Source": "fallback" } }
        );
      } catch {
        return Response.json(
          { logs: [], count: 0 },
          { headers: { "X-Data-Source": "fallback" } }
        );
      }
    }
  }

  // 에이전트 로그 프록시
  if (agent) {
    const limit = searchParams.get("limit") ?? "50";
    try {
      const res = await fetch(
        `${BAMS_SERVER}/api/runs/agent/${agent}/logs?limit=${limit}`
      );
      const data = await res.json();
      return Response.json(data, { headers: { "X-Data-Source": "api" } });
    } catch {
      try {
        const store = EventStore.getInstance();
        const allEvents = store.getAllRawEvents();
        const agentEvents = allEvents.filter((e: Record<string, unknown>) =>
          e.agent_type === agent || String(e.call_id ?? "").startsWith(agent)
        );
        return Response.json(
          { logs: agentEvents, count: agentEvents.length },
          { headers: { "X-Data-Source": "fallback" } }
        );
      } catch {
        return Response.json(
          { logs: [], count: 0 },
          { headers: { "X-Data-Source": "fallback" } }
        );
      }
    }
  }

  return Response.json(
    { error: "pipeline or agent parameter required" },
    { status: 400 }
  );
}
