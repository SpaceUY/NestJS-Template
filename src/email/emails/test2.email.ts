import { registerDynamicEmail } from '../core/register-email';

export default registerDynamicEmail<{ a: number; b: string }>(
  'test2',
  'id-3452413246161',
  {
    subject: 'This is a test',
  },
);
