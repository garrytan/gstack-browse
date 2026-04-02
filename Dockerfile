# syntax=docker/dockerfile:1.7

ARG BASE_IMAGE=mcr.microsoft.com/playwright:v1.58.2-noble
ARG BUN_VERSION=1.3.10

FROM ${BASE_IMAGE} AS base

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/root \
    BUN_INSTALL=/usr/local \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/.claude /root/.codex /workspace

RUN cat <<'EOF' >/usr/local/bin/gstack-container-init
#!/usr/bin/env bash
set -euo pipefail

mkdir -p /root/.claude /root/.codex /root/.config /root/.cache /root/.local/share

# Persist Claude's top-level config file inside the Claude volume.
if [ ! -L /root/.claude.json ]; then
    rm -f /root/.claude.json
    ln -s /root/.claude/.claude.json /root/.claude.json
fi

# If Claude left only a backup, restore the newest backup as the primary config.
if [ ! -s /root/.claude/.claude.json ]; then
    latest_backup="$(ls -1t /root/.claude/backups/.claude.json.backup.* 2>/dev/null | head -n 1 || true)"
    if [ -n "$latest_backup" ]; then
        cp "$latest_backup" /root/.claude/.claude.json
    fi
fi

exec "$@"
EOF
RUN chmod +x /usr/local/bin/gstack-container-init

RUN curl -fsSL https://bun.sh/install | BUN_VERSION=${BUN_VERSION} bash
RUN bun install -g @anthropic-ai/claude-code

WORKDIR /workspace

FROM base AS deps

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

FROM deps AS build

COPY . .
RUN bun run build

FROM base AS runtime

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY --from=build /workspace /workspace

ENTRYPOINT ["/usr/local/bin/gstack-container-init"]
CMD ["bash"]