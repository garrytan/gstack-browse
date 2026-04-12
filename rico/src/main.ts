import { resolveConfig } from "./config";
import { routeQueuedRun, startJobRunner } from "./runtime/job-runner";
import { createSlackRouter } from "./slack/router";
import { openStore } from "./state/store";

export function createRicoRuntime(input: {
  config?: ReturnType<typeof resolveConfig>;
  port?: number;
} = {}) {
  const config = input.config ?? resolveConfig();
  const store = openStore(config.dbPath);
  const runner = startJobRunner({
    db: store.db,
    dispatch: async (context) => {
      routeQueuedRun(context.job);
    },
  });
  const fetch = createSlackRouter({
    db: store.db,
    signingSecret: config.slackSigningSecret,
    triggerDrain: () => runner.kick(),
  });

  return {
    config,
    fetch,
    port: input.port ?? Number(process.env.PORT ?? "3000"),
    runner,
    store,
  };
}

if (import.meta.main) {
  const runtime = createRicoRuntime();
  runtime.runner.start();
  const server = Bun.serve({
    port: runtime.port,
    fetch: runtime.fetch,
  });

  console.log(
    JSON.stringify({
      service: "rico",
      stateDir: runtime.config.stateDir,
      maxActiveProjects: runtime.config.maxActiveProjects,
      port: server.port,
    }),
  );
}
