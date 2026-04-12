import type { SlackMessageClient } from "./publish";

export function createSlackWebClient(token: string): SlackMessageClient {
  return {
    async postMessage(input) {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(input),
      });
      const body = await response.json() as {
        ok: boolean;
        ts?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(`Slack chat.postMessage failed with HTTP ${response.status}`);
      }

      return {
        ok: body.ok,
        ts: body.ts,
      };
    },
  };
}
