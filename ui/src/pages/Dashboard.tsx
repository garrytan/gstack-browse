import { useEffect, useState } from 'react';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import Spinner from '@/components/Spinner';
import type { SystemInfo } from '@/api/client';
import { getSystemInfo, isApiConnected } from '@/api/client';

export default function Dashboard() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemInfo()
      .then(setInfo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="rounded-lg border border-gstack-danger/30 bg-gstack-danger-bg p-4 text-gstack-danger text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!info) return null;

  const browse = info.browseServer;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl font-bold text-white">ダッシュボード</h2>
        <p className="text-sm text-gstack-muted mt-1">gstack システム概要</p>
      </div>

      {info._demo && (
        <div className="rounded-lg border border-gstack-info/30 bg-gstack-info-bg p-4 text-sm text-gstack-info mb-6">
          <strong>デモモード</strong> — APIサーバー未接続。サンプルデータを表示中。
          {isApiConnected() === false && (
            <span className="block text-xs text-gstack-dim mt-1">
              ローカルで <code className="font-mono bg-gstack-border px-1 py-0.5 rounded">bun run ui:server</code> を実行してライブデータに接続。
            </span>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <Card>
          <div className="text-xs text-gstack-muted uppercase tracking-wide mb-1">バージョン</div>
          <div className="text-2xl font-bold text-white font-mono">{info.version}</div>
        </Card>
        <Card>
          <div className="text-xs text-gstack-muted uppercase tracking-wide mb-1">ブランチ</div>
          <div className="text-lg font-mono text-gstack-accent truncate">{info.branch}</div>
        </Card>
        <Card>
          <div className="text-xs text-gstack-muted uppercase tracking-wide mb-1">セッション</div>
          <div className="text-2xl font-bold text-white">{info.sessions}</div>
        </Card>
        <Card>
          <div className="text-xs text-gstack-muted uppercase tracking-wide mb-1">スキル数</div>
          <div className="text-2xl font-bold text-white">{info.skills.length}</div>
        </Card>
      </div>

      {/* Browse server */}
      <Card title="ブラウズサーバー" className="mb-6 md:mb-8">
        {browse ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge
                status={browse.health?.status === 'healthy' ? 'running' : 'warning'}
                label={browse.health?.status === 'healthy' ? '稼働中' : '異常'}
              />
              <span className="text-sm text-gstack-dim font-mono">
                PID {browse.pid} &middot; port {browse.port}
              </span>
            </div>
            {browse.health && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gstack-muted">稼働時間</span>
                  <p className="font-mono text-white">{formatUptime(browse.health.uptime)}</p>
                </div>
                <div>
                  <span className="text-gstack-muted">タブ数</span>
                  <p className="font-mono text-white">{browse.health.tabs}</p>
                </div>
                <div>
                  <span className="text-gstack-muted">現在のURL</span>
                  <p className="font-mono text-gstack-info truncate">{browse.health.currentUrl}</p>
                </div>
              </div>
            )}
            <div className="text-xs text-gstack-dim">
              {new Date(browse.startedAt).toLocaleString()} 開始
              {browse.binaryVersion && <> &middot; バイナリ {browse.binaryVersion.slice(0, 8)}</>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <StatusBadge status="stopped" label="停止中" />
            <span className="text-sm text-gstack-dim">
              初回使用時に自動起動します
            </span>
          </div>
        )}
      </Card>

      {/* Skills overview */}
      <Card title="スキル状態">
        <div className="space-y-2">
          {info.skills.map((skill) => (
            <div
              key={skill.name}
              className="flex items-center justify-between py-2 px-2 md:px-3 rounded hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <StatusBadge status={skill.status} />
                <span className="text-sm font-mono text-white">{skill.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gstack-dim">
                <span>{skill.commandCount} コマンド</span>
                {skill.hasTemplate && (
                  <span className="text-gstack-accent">templated</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
