import testTemplate from 'src/template/templates/test/test.template';
import { registerEmail } from '../core/register-email';

export default registerEmail('test', testTemplate, {
  subject: 'This is a test',
  from: 'test@example.com',
});
