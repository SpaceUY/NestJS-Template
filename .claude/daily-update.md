Date: 2026-06-19
Developer: Franco Mangone

- Implemented the abstract queues module (sender + consumer) per the approved design spec, following the existing adapter pattern
- Added unit specs covering module registration, logger wiring, and the consumer init/destroy lifecycle with DI-resolved handlers
- Documented the module (contracts, registration, ack contract, error codes) in src/queues/README.md
- Built a concrete AWS SQS adapter (sender + consumer) with FIFO support, long-poll consuming, and implicit ack/nack; added @aws-sdk/client-sqs and unit tests; documented it in the README
