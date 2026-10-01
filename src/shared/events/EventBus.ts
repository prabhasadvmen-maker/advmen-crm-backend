import EventEmitter from 'events';

export type EventPayloadMap = {
  'lead.created': { organizationId: string; leadId: string; source: string; score: number; ownerId?: string };
  'lead.status_changed': { organizationId: string; leadId: string; previousStatus: string; newStatus: string; actorId?: string };
  'lead.score_updated': { organizationId: string; leadId: string; score: number; scoreCategory: string };
  'call.completed': { organizationId: string; callId: string; leadId: string; duration: number; disposition?: string };
  'deal.stage_changed': { organizationId: string; dealId: string; previousStage: string; newStage: string; value: number };
  'deal.won': { organizationId: string; dealId: string; value: number; ownerId: string };
  'payment.received': { organizationId: string; invoiceId: string; amount: number; paymentId: string };
  'task.created': { organizationId: string; taskId: string; assignedTo: string; dueAt: string };
  'user.invited': { organizationId: string; userId: string; email: string; role: string };
};

export type EventKey = keyof EventPayloadMap;

class AppEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a typed event asynchronously without blocking callers.
   * Subscribers are isolated in try/catch blocks.
   */
  emit<K extends EventKey>(event: K, payload: EventPayloadMap[K]): void {
    setImmediate(() => {
      this.emitter.emit(event, payload);
    });
  }

  /**
   * Register a subscriber for an event. Handlers are executed safely inside try/catch.
   */
  on<K extends EventKey>(
    event: K,
    handler: (payload: EventPayloadMap[K]) => Promise<void> | void
  ): void {
    this.emitter.on(event, async (payload: EventPayloadMap[K]) => {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`❌ [EventBus Error] Handler for '${String(event)}' failed:`, err);
      }
    });
  }

  /**
   * Remove a subscriber
   */
  off<K extends EventKey>(event: K, handler: (payload: EventPayloadMap[K]) => Promise<void> | void): void {
    this.emitter.off(event, handler as never);
  }
}

export const eventBus = new AppEventBus();
