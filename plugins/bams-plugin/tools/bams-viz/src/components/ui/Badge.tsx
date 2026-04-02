'use client'

type BadgeVariant = 'success' | 'error' | 'running' | 'pending' | 'info'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  pulse?: boolean
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  success: { bg: 'rgba(34,197,94,0.12)', color: 'var(--status-done)', border: 'rgba(34,197,94,0.3)' },
  error: { bg: 'rgba(239,68,68,0.12)', color: 'var(--status-fail)', border: 'rgba(239,68,68,0.3)' },
  running: { bg: 'rgba(59,130,246,0.12)', color: 'var(--status-running)', border: 'rgba(59,130,246,0.3)' },
  pending: { bg: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'var(--border-light)' },
  info: { bg: 'rgba(59,130,246,0.08)', color: 'var(--accent)', border: 'rgba(59,130,246,0.2)' },
}

export function Badge({ variant, children, pulse = false }: BadgeProps) {
  const s = variantStyles[variant]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      lineHeight: '18px',
      whiteSpace: 'nowrap',
    }}>
      {pulse && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: s.color,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      {children}
    </span>
  )
}
