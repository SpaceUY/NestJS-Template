import test2Template from 'src/template/templates/test2/test2.template';
import { registerEmail } from '../core/register-email';

export default registerEmail('test2', test2Template, {
  subject: 'This is a test',
});
