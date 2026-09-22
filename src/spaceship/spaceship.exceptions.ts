import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from '../common/exception/core/ExceptionBase';

// This module owns its own error descriptors (invariant `T3`) instead of
// adding an entry to `src/common/exception/exceptions.ts`. Two reasons: a
// platform module has no business knowing a domain's vocabulary, and this
// module is meant to be deleted — an entry in `common` would survive the
// deletion as a dangling one.
export const SpaceshipExceptions = {
  notFound: (args: { uuid: string }): ExceptionInfo => ({
    httpStatus: HttpStatus.NOT_FOUND,
    errorCode: 'SPACESHIP_NOT_FOUND',
    errorMsg: `Spaceship ${args.uuid} not found`,
  }),
};
