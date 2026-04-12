import { resolveConfig } from "./config";

const config = resolveConfig();

console.log(
  JSON.stringify({
    service: "rico",
    stateDir: config.stateDir,
    maxActiveProjects: config.maxActiveProjects,
  }),
);
