# NestJS Task Execution Module

[![npm version](https://badge.fury.io/js/%40your-org%2Ftasks.svg)](https://badge.fury.io/js/%40your-org%2Ftasks)

A flexible, powerful task execution framework for NestJS applications. This module provides a structured way to define, organize, and execute sequences of tasks with robust error handling, logging, and state management.

## Features

- **Task Sequences**: Define ordered sequences of tasks that execute as a unit
- **Pluggable Architecture**: Easily extend with custom implementations for logging, caching, and error handling
- **Dependency Injection**: Full integration with NestJS dependency injection system
- **Automatic Status Tracking**: Built-in task status tracking and management
- **Flexible Error Handling**: Configurable error handling strategies for each sequence
- **Execution Controls**: Start, success, and error handlers for fine-grained control
- **Configurable Caching**: Pluggable caching system for task results and status

## Installation

[!TODO] Use the Planetary CLI

## Quick Start

### 1. Define a Task

First, create a task that implements the `BaseTaskService` interface:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseTaskService } from 'path-to-tasks-module';

@Injectable()
export class EmailSenderTask implements BaseTaskService {
  constructor(private readonly emailService: EmailService) {}

  async execute(payload: {
    recipient: string;
    subject: string;
    body: string;
  }): Promise<any> {
    await this.emailService.send(
      payload.recipient,
      payload.subject,
      payload.body,
    );
    return { sent: true, timestamp: new Date() };
  }
}
```

> [!NOTE]
> Note that the returned value is what will be passed onto the next execution!

### 2. Define a Task Sequence Module

Create a task sequence by registering your tasks:

```typescript
import { Module } from '@nestjs/common';
import { TaskSequenceModule } from 'path-to-tasks-module';
import { EmailSenderTask } from './tasks/email-sender.task';
import { NotificationTask } from './tasks/notification.task';
import { LoggingTask } from './tasks/logging.task';

const EmailSequenceModule = TaskSequenceModule.register({
  sequenceName: 'email',
  tasks: [
    { id: 'emailSender', task: EmailSenderTask },
    { id: 'notification', task: NotificationTask },
    { id: 'logging', task: LoggingTask },
  ],
});
```

### 3. Register your task sequence in the TasksModule, and ass it in your App

```typescript
import { Module } from '@nestjs/common';
import { TasksModule } from 'path-to-tasks-module';
import { EmailModule, EmailSequenceModule } from './email/email.module';
import { PaymentModule, PaymentSequenceModule } from './payment/payment.module';
import { CustomLogger } from './logger/custom-logger.service';
import { RedisTaskCacheHandler } from './cache/redis-cache-handler.service';

@Module({
  imports: [
    TasksModule.forRoot({
      taskSequences: [EmailSequenceModule, PaymentSequenceModule],
      logger: CustomLogger,
      taskCacheHandler: RedisTaskCacheHandler,
    }),
    EmailModule,
    PaymentModule,
  ],
})
export class AppModule {}
```

### 4. Execute Tasks

Inject the `TaskExecutor` service to run your task sequences:

```typescript
import { Injectable } from '@nestjs/common';
import { TaskExecutor } from 'path-to-tasks-module';

@Injectable()
export class EmailService {
  constructor(private readonly taskExecutor: TaskExecutor) {}

  async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    // Execute a task sequence with an initial payload
    await this.taskExecutor.startSequence('email', {
      recipient: email,
      subject: 'Welcome to our platform!',
      body: 'Thank you for joining...',
      userId,
    });
  }
}
```

## Advanced Usage

### Custom Logger

You can use a custom logger, as long as it implements the `TaskLogger` interface:

```typescript
import { Injectable } from '@nestjs/common';
import { TaskLogger, LoggerInput } from 'path-to-tasks-module';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class CustomTaskLogger implements TaskLogger {
  constructor(private readonly logger: PinoLogger) {}

  setContext(context: string): void {
    this.logger.setContext(context);
  }

  info(input: LoggerInput): void {
    this.logger.info(input);
  }

  warn(input: LoggerInput): void {
    this.logger.warn(input);
  }

  debug(input: LoggerInput): void {
    this.logger.debug(input);
  }

  error(input: LoggerInput): void {
    this.logger.error(input);
  }
}
```

This is also compatible with logging libraries such as `nestjs-pino`.

### Custom Cache Handler

The execution of jobs (task sequence instances) generates certain cached values to keep track
of the job status and intermediate results of tasks.

> [!NOTE]
> The default caching strategy is in-memory, so it's good to defer this to other services if the app is expected to
> execute a large number of jobs.

You can use different caching strategies, simply by implementing the `BaseTaskCacheHandler` interfac:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseTaskCacheHandler } from 'path-to-tasks-module';
import { Redis } from 'ioredis';

@Injectable()
export class RedisTaskCacheHandler implements BaseTaskCacheHandler {
  constructor(private readonly redis: Redis) {}

  async set(key: string, value: string | object): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.redis.set(key, stringValue);
  }

  async get(key: string): Promise<string | undefined> {
    return this.redis.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

### Custom Error and Success Handling

You can specify custom behavior for errors happening during a job execution. For instance, you could send an alert or hit a webhook.
This must be done by extending the `BaseErrorHandlerService`, and providing it as the `errorHandler` in a `TaskSequence` definition.

> [!NOTE]
> Think of this as an error boundary for jobs.

```typescript
import { Injectable } from '@nestjs/common';
import { BaseErrorHandlerService } from 'path-to-tasks-module';

@Injectable()
export class EmailErrorHandler implements BaseErrorHandlerService {
  constructor(private readonly notificationService: NotificationService) {}

  async handleError(error: Error): Promise<any> {
    // Log the error
    console.error('Email task error:', error);

    // Notify system administrators
    await this.notificationService.notifyAdmins(
      `Email task failed: ${error.message}`,
      { error, context },
    );

    // Return a result or rethrow
    return { success: false, error: error.message };
  }
}
```

Similarly, you can implement handlers to execute actions upon a successful job execution, simply by extending `BaseSuccessHandlerService`, and providing the service in the `successHandler` key.

### Custom Start Task Handler

Furthermore, you can control how tasks are started by implementing a custom start task handler and providing it on the `startTaskHandler` key. This allows for a more fine-grained control of task orchestration.
For instance, you could use `bull` to queue the start of the next execution, and have a consumer read from the queue and
leverage the `TaskExecutor` service for the execution itself:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseStartTaskHandlerService } from 'path-to-tasks-module';

@Injectable()
export class TaskQueueingHandler implements BaseStartTaskHandlerService {
  constructor(private readonly taskQueue: TaskQueue) {}

  async handleStart(
    jobId: string,
    taskId: string,
    payload: object,
  ): Promise<any> {
    // Queue the task for asynchronous processing
    await this.taskQueue.enqueue(jobId, taskId, payload);
  }
}
```

## Configuration Options

### TasksModule

The `TasksModule.forRoot()` method accepts the following options:

| Option             | Type                         | Description                                |
| ------------------ | ---------------------------- | ------------------------------------------ |
| `taskSequences`    | `DynamicModule[]`            | Array of task sequence modules to register |
| `logger`           | `Type<TaskLogger>`           | Custom logger implementation               |
| `taskCacheHandler` | `Type<BaseTaskCacheHandler>` | Custom cache handler implementation        |

### TaskSequenceModule

The `TaskSequenceModule.register()` method accepts these options:

| Option             | Type                                               | Description                   |
| ------------------ | -------------------------------------------------- | ----------------------------- |
| `sequenceName`     | `string`                                           | Unique name for the sequence  |
| `tasks`            | `Array<{id: string, task: Type<BaseTaskService>}>` | Tasks to be executed in order |
| `errorHandler`     | `Type<BaseErrorHandlerService>`                    | Custom error handler          |
| `successHandler`   | `Type<BaseSuccessHandlerService>`                  | Custom success handler        |
| `startTaskHandler` | `Type<BaseStartTaskHandlerService>`                | Custom start task handler     |

## Architecture

This module uses a modular architecture with these key components:

- **TasksModule**: The main module that orchestrates everything
- **TaskSequenceModule**: Defines a sequence of tasks
- **TaskExecutor**: Executes task sequences
- **TaskStatusManager**: Tracks and manages task status
- **Providers**: Various providers for logging, caching, etc.

The module follows these design principles:

- **Separation of Concerns**: Each component has a clear responsibility
- **Dependency Injection**: Uses NestJS DI system for loose coupling
- **Pluggable Architecture**: Core components can be replaced with custom implementations
- **Clear Interfaces**: Well-defined interfaces for extending functionality

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
