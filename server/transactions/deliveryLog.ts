import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Delivery, DeliveryResult } from '../../shared/api';

/**
 * Every webhook delivery, including ones refused before they were read. The
 * store only holds verified events; this is the operator's view of the inbox.
 * In memory and bounded, so it resets on restart.
 */
export class DeliveryLog extends EventEmitter<{ delivery: [Delivery] }> {
  private readonly recent: Delivery[] = [];
  private readonly tally: Record<DeliveryResult, number> = {
    applied: 0,
    duplicate: 0,
    stale: 0,
    rejected: 0,
    invalid: 0,
  };

  constructor(private readonly capacity = 100) {
    super();
    this.setMaxListeners(0); // one listener per open SSE connection
  }

  add(entry: Omit<Delivery, 'id' | 'at'>): Delivery {
    const delivery: Delivery = { id: randomUUID(), at: new Date().toISOString(), ...entry };
    this.recent.unshift(delivery);
    if (this.recent.length > this.capacity) this.recent.pop();
    this.tally[delivery.result]++;
    this.emit('delivery', delivery);
    return delivery;
  }

  list(): Delivery[] {
    return [...this.recent];
  }

  counts(): Record<DeliveryResult, number> {
    return { ...this.tally };
  }
}
