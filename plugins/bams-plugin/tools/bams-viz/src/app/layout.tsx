import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bams-viz — Agent Execution Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
