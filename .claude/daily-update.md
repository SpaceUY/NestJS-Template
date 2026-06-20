Date: 2026-06-19
Developer: Franco Mangone

- Implemented the abstract queues module (sender + consumer) per the approved design spec, following the existing adapter pattern
- Added unit specs covering module registration, logger wiring, and the consumer init/destroy lifecycle with DI-resolved handlers
- Documented the module (contracts, registration, ack contract, error codes) in src/queues/README.md
- Built a concrete AWS SQS adapter (sender + consumer) with FIFO support, long-poll consuming, and implicit ack/nack; added @aws-sdk/client-sqs and unit tests; documented it in the README
- Built a concrete RabbitMQ adapter on amqplib (sender + consumer) with exchange support (dedicated publishToExchange method + reserved-header routing), assertTopology flag, lazy fail-fast connection, prefetch, and implicit ack/nack; added amqplib (used its bundled types) and unit tests; documented it in the README
