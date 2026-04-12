const textEncoder = new TextEncoder();

export interface SlackArtifactReference {
  fileId?: string;
  permalink?: string;
  title?: string;
}

export interface SlackArtifactInput {
  fileId?: string;
  permalink?: string;
  title?: string;
  localPath?: string;
}

export interface SlackExternalUploadClient {
  getUploadURLExternal(input: {
    filename: string;
    length: number;
  }): Promise<{ upload_url: string; file_id: string }>;
  uploadBinary(input: {
    url: string;
    content: Uint8Array;
  }): Promise<unknown>;
  completeUploadExternal(input: {
    files: Array<{ id: string; title: string }>;
    channel_id?: string;
    thread_ts?: string;
  }): Promise<{
    ok: boolean;
    files?: Array<{ id: string; title?: string; permalink?: string }>;
  }>;
}

export interface UploadTextArtifactInput {
  client: SlackExternalUploadClient;
  channelId?: string;
  threadTs?: string;
  artifact: {
    fileName: string;
    content: string;
    title?: string;
  };
}

export function toSlackArtifact(input: SlackArtifactInput): SlackArtifactReference {
  if (input.localPath && !input.fileId && !input.permalink) {
    throw new Error("Slack cannot receive raw local paths");
  }

  if (!input.fileId && !input.permalink) {
    throw new Error("Slack artifact must include a Slack file id or permalink");
  }

  return {
    fileId: input.fileId,
    permalink: input.permalink,
    title: input.title,
  };
}

export async function uploadTextArtifact(input: UploadTextArtifactInput) {
  const content = textEncoder.encode(input.artifact.content);
  const ticket = await input.client.getUploadURLExternal({
    filename: input.artifact.fileName,
    length: content.byteLength,
  });

  await input.client.uploadBinary({
    url: ticket.upload_url,
    content,
  });

  const completed = await input.client.completeUploadExternal({
    files: [
      {
        id: ticket.file_id,
        title: input.artifact.title ?? input.artifact.fileName,
      },
    ],
    channel_id: input.channelId,
    thread_ts: input.threadTs,
  });
  if (!completed.ok) {
    throw new Error("Slack did not finalize artifact upload");
  }

  const uploadedFile = completed.files?.[0];
  return toSlackArtifact({
    fileId: uploadedFile?.id ?? ticket.file_id,
    permalink: uploadedFile?.permalink,
    title: uploadedFile?.title ?? input.artifact.title ?? input.artifact.fileName,
  });
}
