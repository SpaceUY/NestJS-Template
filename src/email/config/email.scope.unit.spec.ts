import { EMAIL_ADAPTERS, emailScope, EmailScopeConfig } from './email.scope';

const validate = (raw: Record<string, unknown>): EmailScopeConfig => {
  if (!emailScope.validate) throw new Error('email scope has no validator');
  return emailScope.validate(raw);
};

/** The same environment minus one variable — an operator who forgot it. */
const without = (
  raw: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const copy = { ...raw };
  delete copy[field];
  return copy;
};

describe('emailScope', () => {
  describe('the console adapter, the local-development path', () => {
    it('validates an empty environment and picks the console adapter', () => {
      expect(validate({})).toEqual({
        adapter: EMAIL_ADAPTERS.CONSOLE,
        from: '',
        sendgridApiKey: '',
        resendApiKey: '',
        sesRegion: '',
        sesAccessKeyId: '',
        sesSecretAccessKey: '',
      });
    });

    it('asks for no provider credential when selected explicitly', () => {
      expect(validate({ adapter: EMAIL_ADAPTERS.CONSOLE })).toEqual({
        adapter: EMAIL_ADAPTERS.CONSOLE,
        from: '',
        sendgridApiKey: '',
        resendApiKey: '',
        sesRegion: '',
        sesAccessKeyId: '',
        sesSecretAccessKey: '',
      });
    });

    // The console adapter prints the message instead of delivering it, so a
    // sender address there reaches nobody. Requiring one would mean a clone of
    // the template could not boot until someone edited `.env`.
    it('does not require EMAIL_FROM', () => {
      expect(validate({ adapter: EMAIL_ADAPTERS.CONSOLE }).from).toBe('');
    });

    // The `C2` shape: a plausible default sender would be used in production
    // by a deploy that simply forgot to set EMAIL_FROM.
    it('invents no sender address to fall back on', () => {
      expect(validate({}).from).toBe('');
    });

    it('tolerates the empty provider values `.env.example` ships', () => {
      expect(
        validate({
          adapter: EMAIL_ADAPTERS.CONSOLE,
          from: '',
          sendgridApiKey: '',
          resendApiKey: '',
          resendEmailFrom: '',
          sesRegion: '',
          sesAccessKeyId: '',
          sesSecretAccessKey: '',
        }).adapter,
      ).toBe(EMAIL_ADAPTERS.CONSOLE);
    });
  });

  describe('SendGrid', () => {
    const configured = {
      adapter: EMAIL_ADAPTERS.SENDGRID,
      from: 'sender@example.com',
      sendgridApiKey: 'SG.a-real-key',
    };

    it('accepts an API key and a sender', () => {
      expect(validate(configured)).toEqual({
        ...configured,
        resendApiKey: '',
        sesRegion: '',
        sesAccessKeyId: '',
        sesSecretAccessKey: '',
      });
    });

    it('names SENDGRID_API_KEY when the key is missing', () => {
      expect(() =>
        validate({ adapter: EMAIL_ADAPTERS.SENDGRID, from: 'a@example.com' }),
      ).toThrow(/SENDGRID_API_KEY is required when EMAIL_ADAPTER=SENDGRID/);
    });

    it('names SENDGRID_API_KEY when the key is set but empty', () => {
      expect(() => validate({ ...configured, sendgridApiKey: '' })).toThrow(
        /SENDGRID_API_KEY is required/,
      );
    });

    it('names EMAIL_FROM when the sender is missing', () => {
      expect(() =>
        validate({
          adapter: EMAIL_ADAPTERS.SENDGRID,
          sendgridApiKey: 'SG.a-real-key',
        }),
      ).toThrow(/EMAIL_FROM is required/);
    });
  });

  describe('Resend', () => {
    const configured = {
      adapter: EMAIL_ADAPTERS.RESEND,
      from: 'sender@example.com',
      resendApiKey: 're_a_real_key',
    };

    it('accepts an API key and a sender', () => {
      expect(validate(configured)).toEqual({
        ...configured,
        sendgridApiKey: '',
        sesRegion: '',
        sesAccessKeyId: '',
        sesSecretAccessKey: '',
      });
    });

    it('names RESEND_API_KEY when the key is missing', () => {
      expect(() =>
        validate({ adapter: EMAIL_ADAPTERS.RESEND, from: 'a@example.com' }),
      ).toThrow(/RESEND_API_KEY is required when EMAIL_ADAPTER=RESEND/);
    });

    it('names RESEND_API_KEY when the key is set but empty', () => {
      expect(() => validate({ ...configured, resendApiKey: '' })).toThrow(
        /RESEND_API_KEY is required/,
      );
    });

    it('names EMAIL_FROM when the sender is missing', () => {
      expect(() =>
        validate({
          adapter: EMAIL_ADAPTERS.RESEND,
          resendApiKey: 're_a_real_key',
        }),
      ).toThrow(/EMAIL_FROM is required/);
    });

    // Joi never validates its own defaults, so the old `''` default was a
    // value this very schema rejects. There is no default now.
    it('leaves RESEND_EMAIL_FROM unset rather than defaulting it', () => {
      expect(validate(configured).resendEmailFrom).toBeUndefined();
    });

    it('keeps a RESEND_EMAIL_FROM override', () => {
      expect(
        validate({ ...configured, resendEmailFrom: 'resend@example.com' })
          .resendEmailFrom,
      ).toBe('resend@example.com');
    });

    it('rejects a RESEND_EMAIL_FROM that is not an address', () => {
      expect(() =>
        validate({ ...configured, resendEmailFrom: 'not-an-address' }),
      ).toThrow(/RESEND_EMAIL_FROM must be a valid email address/);
    });
  });

  describe('AWS SES', () => {
    const configured = {
      adapter: EMAIL_ADAPTERS.AWS_SES,
      from: 'sender@example.com',
      sesRegion: 'us-east-1',
      sesAccessKeyId: 'AKIAEXAMPLE',
      sesSecretAccessKey: 'a-secret',
    };

    it('accepts a region, both credentials and a sender', () => {
      expect(validate(configured)).toEqual({
        ...configured,
        sendgridApiKey: '',
        resendApiKey: '',
      });
    });

    // AwsSesAdapterService builds its SESClient with an explicit credentials
    // object, so it never falls back to the ambient AWS credential chain:
    // all three of these are genuinely mandatory.
    it('names AWS_SES_REGION when the region is missing', () => {
      expect(() => validate(without(configured, 'sesRegion'))).toThrow(
        /AWS_SES_REGION is required when EMAIL_ADAPTER=AWS_SES/,
      );
    });

    it('names AWS_ACCESS_KEY when the access key is missing', () => {
      expect(() => validate(without(configured, 'sesAccessKeyId'))).toThrow(
        /AWS_ACCESS_KEY is required when EMAIL_ADAPTER=AWS_SES/,
      );
    });

    it('names AWS_SECRET_ACCESS_KEY when the secret is missing', () => {
      expect(() => validate(without(configured, 'sesSecretAccessKey'))).toThrow(
        /AWS_SECRET_ACCESS_KEY is required when EMAIL_ADAPTER=AWS_SES/,
      );
    });

    it('names every missing variable at once, not just the first', () => {
      expect(() => validate({ adapter: EMAIL_ADAPTERS.AWS_SES })).toThrow(
        /EMAIL_FROM[\s\S]*AWS_SES_REGION[\s\S]*AWS_ACCESS_KEY[\s\S]*AWS_SECRET_ACCESS_KEY/,
      );
    });

    it('names EMAIL_FROM when the sender is missing', () => {
      expect(() => validate(without(configured, 'from'))).toThrow(
        /EMAIL_FROM is required/,
      );
    });

    it('rejects an EMAIL_FROM that is not an address', () => {
      expect(() => validate({ ...configured, from: 'postmaster' })).toThrow(
        /EMAIL_FROM must be a valid email address/,
      );
    });

    // Invariant T4: a validation failure is read by whoever is watching the
    // boot log, so it may name the variable but never echo its value.
    it('never echoes a credential value into the failure message', () => {
      const secret = 'wJalrXUtnFEMI-super-secret';
      let message = '';
      try {
        validate({
          ...configured,
          from: 'postmaster',
          sesSecretAccessKey: secret,
        });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/EMAIL_FROM/);
      expect(message).not.toContain(secret);
    });
  });

  describe('the shape of the scope itself', () => {
    it('refuses an adapter the factory in app.module cannot build', () => {
      expect(() => validate({ adapter: 'MAILGUN' })).toThrow(
        /EMAIL_ADAPTER must be one of/,
      );
    });

    it('refuses a lowercase adapter name', () => {
      expect(() => validate({ adapter: 'console' })).toThrow(
        /EMAIL_ADAPTER must be one of/,
      );
    });

    it('refuses a key the scope does not declare', () => {
      expect(() => validate({ sendgridKey: 'SG.a-real-key' })).toThrow(
        /sendgridKey/,
      );
    });

    it('declares a source for every field it validates', () => {
      expect(Object.keys(emailScope.fields).sort()).toEqual(
        [
          'adapter',
          'from',
          'resendApiKey',
          'resendEmailFrom',
          'sendgridApiKey',
          'sesAccessKeyId',
          'sesRegion',
          'sesSecretAccessKey',
        ].sort(),
      );
    });
  });
});
