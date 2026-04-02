'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

export function usePolling<T>(url: string | null, interval = 1000) {
  const { data, error, isLoading, isValidating } = useSWR<T>(
    url,
    fetcher,
    {
      refreshInterval: interval,
      revalidateOnFocus: true,
      dedupingInterval: 500,
    }
  )
  return { data, error, isLoading, isValidating }
}
