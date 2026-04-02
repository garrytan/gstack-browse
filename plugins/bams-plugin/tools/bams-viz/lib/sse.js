/**
 * SSE (Server-Sent Events) connection manager
 */
export class SSEManager {
  constructor() {
    /** @type {Set<import('http').ServerResponse>} */
    this.clients = new Set();
    this._heartbeatInterval = null;
  }

  /**
   * Handle new SSE connection
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @param {Object[]} [initialEvents] - Events to replay on connect
   */
  connect(req, res, initialEvents = []) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Replay existing events
    if (initialEvents.length > 0) {
      res.write(`event: init\ndata: ${JSON.stringify(initialEvents)}\n\n`);
    }

    this.clients.add(res);
    req.on('close', () => this.clients.delete(res));

    // Start heartbeat if not already running
    if (!this._heartbeatInterval) {
      this._heartbeatInterval = setInterval(() => {
        this.broadcast('heartbeat', { ts: new Date().toISOString() });
      }, 30000);
    }
  }

  /**
   * Broadcast event to all connected clients
   * @param {string} eventType
   * @param {Object} data
   */
  broadcast(eventType, data) {
    const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(msg);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Close all connections
   */
  close() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    for (const client of this.clients) {
      try { client.end(); } catch {}
    }
    this.clients.clear();
  }
}
