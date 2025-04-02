# Push Notification Module

A NestJS module that provides Push Notification functionality with a clean, injectable service interface.

## Overview

This module provides Push Notification files solution for NestJS applications. It includes:

- A configurable Push Notification module
- A service wrapper for Push Notification operations
- Endpoint for send a push notification for test purposes
- Expo Server SDK Integration

## Directory Structure

```
push-notification/
├── abstract/
│   ├── dto/
│   ├── push-notification-abstract.module.ts
│   ├── push-notification-error-codes.ts
│   ├── push-notification-provider.const.ts
│   ├── push-notification.controller.ts
│   ├── push-notification.exception.ts
│   ├── push-notification.service.ts
├── expo-adapter/
│   ├── expo-adapter-config.provider.const.ts
│   ├── expo-adapter-config.interface.ts
│   ├── expo-adapter.module.ts
│   ├── expo-adapter.service.ts
└── README.md

```

## Features

- Configurable Push Notification connection
- Push Notification provider operations, sendNotification and sendNotificationByChunks
- Easy-to-use service interface
- Expo Server SDK support
- Integration with NestJS dependency injection

## Installation

Ensure you have the required dependencies:

```bash
npm expo-server-sdk
```

## Usage

### 1. Import the Module

#### Single Node Mode

```typescript
import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PushNotificationAbstractModule } from './push-notification/abstract/push-notification-abstract.module.ts';
import { ExpoAdapterModule } from './push-notification/expo-adapter/expo-adapter.module';
import expoConfig from './config/expo.config'; // Your expo config

@Module({
  imports: [
    PushNotificationAbstractModule.forRoot({
      adapter: ExpoAdapterModule.registerAsync({
        inject: [expoConfig.KEY],
        useFactory: (expo: ConfigType<typeof expoConfig>) => ({
          expoAccessToken: expo.accessToken,
        }),
      }),
      useDefaultController: true,
      isGlobal: true,
    })
  ],
})
export class AppModule {}
```

### 2. Use the Push Notification Service

```typescript
import { Injectable } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class YourService {
  constructor(private pushNotificationService: PushNotificationService) {}

   sendPushNotification(pushToken: string,
    notification: IPushNotification): Promise<PushNotificationSuccessResponse> {
    return await this.pushNotificationService.sendPushNotification(
        token,
        notificationDto,
      );
  }
}
```

## Using the Expo Adapter with PushNotificationAbstractModule

To make the `PushNotificationAbstractModule` work with the Expo adapter, it's required to extend the `PushNotificationService` class. Specifically, in your `ExpoAdapterService` class that extends `PushNotificationService`. This extension is necessary for the PushNotificationAbstractModule to interact with the Expo provider.

If your project only requires the Expo adapter and you know that you won't need to change the provider, you can skip using the abstract module and directly import the ExpoAdapterModule into your project.

**Fix Import Paths Manually (If Needed)**:

  After copying the files, you might need to fix the import paths manually. Ensure that the import paths for the PushNotificationService and the ExpoAdapterService are correct according to your project structure. If you encounter any errors related to the imports, double-check that the paths are resolved correctly.

  In your project, find a service that extends `PushNotificationService`, and adjust the import path if needed, like this:

  ```typescript
  import { PushNotificationService } from 'path-to-push-notification-service'; // Adjust the import path
  import { Injectable } from '@nestjs/common';

  @Injectable()
  export class ExpoAdapterService extends PushNotificationService {
  }
   
```


## Configuration Options

The `PushNotificationAbstractModule.forRoot()` method accepts standard Expo configuration options:

```typescript
static forRoot(options: { adapter: DynamicModule }): DynamicModule
```

There's also a `registerAsync` option which allows for dependency injection. For instance, the module can be used in the following fashion:

```typescript
PushNotificationAbstractModule.forRoot({
  adapter: ExpoAdapterModule.registerAsync({
    inject: [expoConfig.KEY],
    useFactory: (expo: ConfigType<typeof expoConfig>) => ({
      expoAccessToken: expo.accessToken,
    }),
  }),
}),
```

Assuming that a `expoConfig` is registered using `@nestjs/common`'s `registerAs` method. 

## API Reference

The `PushNotificationAbstractModule` allows the optional registration of a default controller (`PushNotificationController`), which expose an endpoint for test purposes to send a notification to a specific token device.

### PushNotificationController

The main endpoint for interacting with push notification provider:

```typescript
class PushNotificationController {
  // Send a push notification to a specific token device
  async sendPushNotification(
    @Param('token') token: string,
    @Body() notificationDto: PushNotificationDto,
  ): Promise<void>
}
```

### **Enabling the Default Controller**

To use the default controller, set `useDefaultController: true` when registering the module:

```typescript
import { Module } from '@nestjs/common';
import { PushNotificationAbstractModule } from './push-notification/push-notification-abstract.module';
import { ExpoAdapterModule } from './adapters/expo-adapter.module';

@Module({
  imports: [
    PushNotificationAbstractModule.forRoot({
      adapter: ExpoAdapterModule.registerAsync({
        inject: [expoConfig.KEY],
        useFactory: (expo: ConfigType<typeof expoConfig>) => ({
          expoAccessToken: expo.accessToken,
        }),
      }),
      useDefaultController: true, // Enables the default controller
      isGlobal: true, // If you need, enables the module as global
    }),
  ],
})
export class AppModule {}
```

### **Enabling a Custom Controller**

To use a custom controller, set `useDefaultController: false` when registering the module:

```typescript
import { Module } from '@nestjs/common';
import { PushNotificationAbstractModule } from './push-notification/push-notification-abstract.module';
import { ExpoAdapterModule } from './adapters/expo-adapter.module';
import { CustomNotificationController } from './custom-notification.controller';

@Module({
  imports: [
    PushNotificationAbstractModule.forRoot({
      adapter: ExpoAdapterModule.registerAsync({
        inject: [expoConfig.KEY],
        useFactory: (expo: ConfigType<typeof expoConfig>) => ({
          expoAccessToken: expo.accessToken,
        }),
      }),
      useDefaultController: false, // Disable the default controller
      customController: [YourController], // Registers the custom controller
      isGlobal: true, // If you need, enables the module as global
    }),
  ], 
})
export class AppModule {}

```

## Extending Functionality with Other Push Notification Providers

The `PushNotificationAbstractModule` is designed to be flexible and support multiple push notification providers. To add support for another provider, follow these steps:

1. **Create a New Adapter**  
   - Create a new directory inside `push-notification`, for example: `firebase-adapter/` for Firebase Admin.  
   - Implement a service that extends the `PushNotificationService` abstract class defined in `push-notification/abstract/push-notification.service.ts`.

2. **Define the Adapter Module**  
   - Create a module similar to `ExpoAdapterModule` to initialize the new provider.  
   - Ensure it provides a configuration mechanism (e.g., `register` or `registerAsync` methods).

3. **Register the Adapter in the Abstract Module**  
   - Modify `PushNotificationAbstractModule` to accept the new adapter as a dynamic module.  
   - Example:  
   ```typescript
   PushNotificationAbstractModule.forRoot({
     adapter: FirebaseAdapterModule.registerAsync({
       inject: [firebaseConfig.KEY],
       useFactory: (firebase: ConfigType<typeof firebaseConfig>) => ({
         token: firebase.token,
       }),
     }),
   }),
   ```
4. **Implement Provider-Specific Logic**
  - Ensure the new adapter correctly implements methods such as sendPushNotification and sendPushNotificationByChunks.
  - Use the respective SDK (e.g., firebase-admin for Firebase).
  - By following this structure, you can easily extend the push notification module to support different providers like Firebase or others.

## Best Practices

1. **Message Formatting & Consistency**

   - Use a consistent payload structure for all notifications.
   - Include clear titles and concise messages to improve user engagement.
   - Use localization when sending notifications to support multiple languages.

2. **Error Handling & Retry Mechanism**

   - Log all notification requests and responses for debugging.
   - Implement a retry mechanism for failed notifications, considering exponential backoff.
   - Store failed notifications for future reprocessing, especially for critical messages.

3. **Security & Privacy**

   - Use authentication when managing push tokens in your backend.
   - Do not expose push tokens in logs or client-side code.
   - Encrypt sensitive data included in the notification payload.

4. **Performance & Scalability**
   - Send notifications in batches using chunking mechanisms.
   - Implement asynchronous processing for large-scale notifications.
   - Monitor push notification response times and delivery rates to detect bottlenecks.
   - Implement asynchronous processing for large-scale notifications.

## Contributing

Feel free to submit issues and enhancement requests!