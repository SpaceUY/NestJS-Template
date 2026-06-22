Date: 2026-06-19
Developer: Franco Mangone

- Implemented the abstract queues module (sender + consumer) per the approved design spec, following the existing adapter pattern
- Added unit specs covering module registration, logger wiring, and the consumer init/destroy lifecycle with DI-resolved handlers
- Documented the module (contracts, registration, ack contract, error codes) in src/queues/README.md
- Built a concrete AWS SQS adapter (sender + consumer) with FIFO support, long-poll consuming, and implicit ack/nack; added @aws-sdk/client-sqs and unit tests; documented it in the README
- Built a concrete RabbitMQ adapter on amqplib (sender + consumer) with exchange support (dedicated publishToExchange method + reserved-header routing), assertTopology flag, lazy fail-fast connection, prefetch, and implicit ack/nack; added amqplib (used its bundled types) and unit tests; documented it in the README
- Built a concrete BullMQ adapter (sender + consumer) on Redis/ioredis with emulated ack/nack over BullMQ's complete/fail job model (UnrecoverableError for no-requeue), header wrapping, worker concurrency, and queue cleanup on destroy; added bullmq and unit tests; documented it (including the attempts/retry caveat) in the README
- Extended the queues interfaces with broker-agnostic per-message delivery options (delay/priority) on the send side and a deliveryCount on the consume side; adapters now honor-or-throw (new UNSUPPORTED_OPTION error) per an honest support matrix, and BullMQ gained an addJob method for richer options (attempts/backoff/etc.); updated all three adapters, tests, and the README
- Moved each queue adapter's unit tests into a tests/ subfolder (sqs/rabbitmq/bullmq) via git mv, fixing the relative imports; jest still discovers them and the build still excludes them
- Moved the two abstract queue module specs into src/queues/abstract/tests/ as well, so every queues spec now lives in a tests/ subfolder
- Applied the same tests/ subfolder convention to cloud-storage, config-provider, common/logger, and email (12 spec files moved via git mv with imports fixed); cache had no unit specs to move
