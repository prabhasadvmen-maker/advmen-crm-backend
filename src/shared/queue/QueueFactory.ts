import { Queue, QueueOptions, JobsOptions, Worker, Processor } from 'bullmq';
import { env } from '../../config/env.js';

export class QueueFactory {
  private static queues: Map<string, Queue> = new Map();

  private static getRedisConnection() {
    return {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    };
  }

  /**
   * Standard default job options across all queues
   */
  static getDefaultJobOptions(): JobsOptions {
    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 604800, // 7 days (DLQ review)
      },
    };
  }

  /**
   * Get or create a BullMQ queue
   */
  static getQueue(name: string, customOptions?: Partial<QueueOptions>): Queue {
    if (!this.queues.has(name)) {
      try {
        const queue = new Queue(name, {
          connection: this.getRedisConnection(),
          defaultJobOptions: this.getDefaultJobOptions(),
          ...customOptions,
        });

        this.queues.set(name, queue);
      } catch (err) {
        console.warn(`⚠️ Could not instantiate BullMQ Queue '${name}':`, err);
      }
    }

    return this.queues.get(name)!;
  }

  /**
   * Helper to create a BullMQ worker
   */
  static createWorker<T>(
    queueName: string,
    processor: Processor<T>,
    concurrency: number = 5
  ): Worker<T> {
    const worker = new Worker<T>(queueName, processor, {
      connection: this.getRedisConnection(),
      concurrency,
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ [Queue Worker: ${queueName}] Job ${job?.id} failed:`, err.message);
    });

    worker.on('completed', (job) => {
      // In debug mode, log completion
      if (env.NODE_ENV === 'development') {
        console.log(`✅ [Queue Worker: ${queueName}] Job ${job.id} completed successfully`);
      }
    });

    return worker;
  }
}
