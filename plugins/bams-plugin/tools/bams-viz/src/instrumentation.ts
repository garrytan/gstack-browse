export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { EventStore } = await import('./lib/event-store')
    const store = EventStore.getInstance()
    store.initialize(EventStore.findCrewRoot())
  }
}
