import { Test } from '@nestjs/testing';

describe('Auth0 Packages Import Test', () => {
  beforeEach(async () => {
    await Test.createTestingModule({}).compile();
  });

  it('should import auth0 package successfully', async () => {
    const auth0 = await import('auth0');
    expect(auth0).toBeDefined();
    expect(auth0.ManagementClient).toBeDefined();
    expect(auth0.AuthenticationClient).toBeDefined();
  });

  it('should import passport-auth0 package successfully', async () => {
    const passportAuth0 = await import('passport-auth0');
    expect(passportAuth0).toBeDefined();
    expect(passportAuth0.Strategy).toBeDefined();
  });

  it('should import jwks-rsa package successfully', async () => {
    const jwksRsa = await import('jwks-rsa');
    expect(jwksRsa).toBeDefined();
    expect(jwksRsa.expressJwtSecret).toBeDefined();
    expect(jwksRsa.passportJwtSecret).toBeDefined();
  });

  it('should import express-jwt package successfully', async () => {
    const expressJwt = await import('express-jwt');
    expect(expressJwt).toBeDefined();
    expect(expressJwt.expressjwt).toBeDefined();
  });
});
