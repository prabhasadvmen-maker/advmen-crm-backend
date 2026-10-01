import { AppError } from '../errors/AppError.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // e.g. 5 failures to trip
  resetTimeoutMs?: number;   // e.g. 30000ms cooldown window
  serviceName?: string;
}

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly serviceName: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.serviceName = options.serviceName || 'External Service';
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        console.warn(`⚡ [CircuitBreaker: ${this.serviceName}] Transitioned to HALF_OPEN. Testing provider recovery...`);
      } else {
        throw AppError.circuitOpen(this.serviceName);
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log(`✅ [CircuitBreaker: ${this.serviceName}] Closed again after successful recovery.`);
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error(`🚨 [CircuitBreaker: ${this.serviceName}] Tripped to OPEN state (${this.failureCount} consecutive failures).`);
    }
  }

  getState(): string {
    switch (this.state) {
      case CircuitState.CLOSED:
        return 'CLOSED';
      case CircuitState.OPEN:
        return 'OPEN';
      case CircuitState.HALF_OPEN:
        return 'HALF_OPEN';
    }
  }
}
