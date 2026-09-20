import { Inject, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QueueConsumerAdapter } from './queue-consumer.adapter';
import { QueueConsumerHandler } from './queue-consumer.handler';
import { ConsumerRegistration } from './queue-consumer.interfaces';

export const QUEUE_FEATURE_CONSUMERS = 'QUEUE_FEATURE_CONSUMERS';

/**
 * Backs `QueueConsumerModule.forFeature`. One instance exists per `forFeature`
 * call, each owning only the registrations passed to that call.
 *
 * Unlike the root path, this module does **not** provide the handler classes.
 * The domain module declares them as ordinary providers, so a handler's
 * dependencies resolve in the injector that already has them and no caller has
 * to re-import them on the handler's behalf.
 *
 * Requires the root registration to have been made with `isGlobal: true`: the
 * adapter is injected here without importing the root module.
 */
@Module({})
export class QueueConsumerFeatureModule
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly adapter: QueueConsumerAdapter,
    @Inject(QUEUE_FEATURE_CONSUMERS)
    private readonly consumers: ConsumerRegistration[],
  ) {}

  /**
   * Resolves each registered handler from anywhere in the container and starts
   * consuming its queue.
   *
   * `strict: false` is required: the handler is provided by the domain module,
   * not by this one. Resolution happens here rather than in the constructor so
   * a handler whose module initialises later is still found.
   *
   * @returns {Promise<void>} Resolves once every registration has started.
   */
  async onModuleInit(): Promise<void> {
    for (const { queue, handler } of this.consumers) {
      const instance = this.moduleRef.get<QueueConsumerHandler>(handler, {
        strict: false,
      });
      await this.adapter.startConsuming(queue, instance.handle.bind(instance));
    }
  }

  /**
   * Stops only the queues this registration owns, leaving other feature
   * registrations and the root's own consumers untouched.
   *
   * @returns {Promise<void>} Resolves once every registration has stopped.
   */
  async onModuleDestroy(): Promise<void> {
    for (const { queue } of this.consumers) {
      await this.adapter.stopConsuming(queue);
    }
  }
}
