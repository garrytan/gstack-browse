'use client'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
}

export function EmptyState({ icon = '📭', title, description }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: 'var(--text-muted)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
      <div style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '8px',
      }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '13px', maxWidth: '400px' }}>
          {description}
        </div>
      )}
    </div>
  )
}
