import { DynamicModule, ForwardReference, Module, Type } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationController } from './push-notification.controller';
import { PUSH_NOTIFICATION_PROVIDER } from './push-notification-provider.const';

type AdapterModule =
  | Type<any>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

interface PushNotificationModuleOptions {
  adapter: AdapterModule;
  useDefaultController?: boolean;
  isGlobal?: boolean;
  controllers?: Type<any>[];
}

@Module({})
export class PushNotificationAbstractModule {
  static forRoot(options: PushNotificationModuleOptions): DynamicModule {
    const {
      adapter,
      isGlobal = false,
      useDefaultController = true,
      controllers = [],
    } = options;

    if (useDefaultController) {
      controllers.push(PushNotificationController);
    }
    return {
      module: PushNotificationAbstractModule,
      global: isGlobal,
      providers: [
        {
          provide: PushNotificationService,
          useFactory: (adapter) => adapter,
          inject: [PUSH_NOTIFICATION_PROVIDER],
        },
      ],
      imports: [adapter],
      exports: [PushNotificationService],
      controllers,
    };
  }
} // TODO: Add forRootAsync
