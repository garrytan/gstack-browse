import {
  uploadTextArtifact,
  type SlackArtifactReference,
  type SlackExternalUploadClient,
} from "./files";

export interface ImpactMessageInput {
  role: string;
  summary: string;
  impact: string;
  artifactLabel: string;
}

export interface SlackMessageClient {
  postMessage(input: {
    channel: string;
    thread_ts?: string;
    text: string;
  }): Promise<{ ok: boolean; ts?: string }>;
}

export interface PublishImpactUpdateInput {
  client: SlackExternalUploadClient & SlackMessageClient;
  channelId: string;
  threadTs?: string;
  role: string;
  summary: string;
  impact: string;
  artifact: {
    fileName: string;
    content: string;
    title?: string;
  };
}

function roleLabel(role: string) {
  return role.toUpperCase();
}

function artifactLinkText(artifact: SlackArtifactReference) {
  return artifact.permalink ?? artifact.fileId ?? artifact.title ?? "artifact";
}

export function buildImpactMessage(input: ImpactMessageInput) {
  return `[${roleLabel(input.role)} Impact] ${input.summary} (${input.impact}) -> ${input.artifactLabel}`;
}

export async function publishImpactUpdate(input: PublishImpactUpdateInput) {
  const uploaded = await uploadTextArtifact({
    client: input.client,
    channelId: input.channelId,
    threadTs: input.threadTs,
    artifact: input.artifact,
  });

  const text = `${buildImpactMessage({
    role: input.role,
    summary: input.summary,
    impact: input.impact,
    artifactLabel: input.artifact.title ?? input.artifact.fileName,
  })}\n${artifactLinkText(uploaded)}`;

  const message = await input.client.postMessage({
    channel: input.channelId,
    thread_ts: input.threadTs,
    text,
  });
  if (!message.ok) {
    throw new Error("Slack rejected impact message");
  }

  return {
    uploaded,
    messageTs: message.ts,
    text,
  };
}
