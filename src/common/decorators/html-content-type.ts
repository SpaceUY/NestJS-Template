import { Header } from '@nestjs/common';

export function Html(): MethodDecorator {
  return Header('content-type', 'text/html');
}
