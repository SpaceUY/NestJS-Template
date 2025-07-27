import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Auth0ConfigService } from './auth0-config.service';
import auth0Config from './auth0.config';

describe('Auth0ConfigService', () => {
  let service: Auth0ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [auth0Config],
        }),
      ],
      providers: [Auth0ConfigService],
    }).compile();

    service = module.get<Auth0ConfigService>(Auth0ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('configuration values', () => {
    it('should return domain from environment', () => {
      expect(service.domain).toBeDefined();
    });

    it('should return client ID from environment', () => {
      expect(service.clientId).toBeDefined();
    });

    it('should return client secret from environment', () => {
      expect(service.clientSecret).toBeDefined();
    });

    it('should return audience from environment', () => {
      expect(service.audience).toBeDefined();
    });

    it('should return issuer URL', () => {
      expect(service.issuer).toContain('https://');
    });

    it('should return algorithm', () => {
      expect(service.algorithm).toBeDefined();
    });

    it('should return callback URL', () => {
      expect(service.callbackUrl).toBeDefined();
    });

    it('should return logout URL', () => {
      expect(service.logoutUrl).toBeDefined();
    });

    it('should return token expiration', () => {
      expect(service.tokenExpiration).toBeGreaterThan(0);
    });

    it('should return refresh token rotation setting', () => {
      expect(typeof service.refreshTokenRotation).toBe('boolean');
    });

    it('should return debug setting', () => {
      expect(typeof service.debug).toBe('boolean');
    });

    it('should return log level', () => {
      expect(service.logLevel).toBeDefined();
    });
  });

  describe('computed URLs', () => {
    it('should return JWKS URI', () => {
      expect(service.jwksUri).toContain('/.well-known/jwks.json');
    });

    it('should return authorization URL', () => {
      expect(service.authorizationUrl).toContain('/authorize');
    });

    it('should return token URL', () => {
      expect(service.tokenUrl).toContain('/oauth/token');
    });

    it('should return user info URL', () => {
      expect(service.userInfoUrl).toContain('/userinfo');
    });

    it('should return logout URL', () => {
      expect(service.auth0LogoutUrl).toContain('/v2/logout');
    });
  });

  describe('management API', () => {
    it('should return management client ID', () => {
      expect(service.managementClientId).toBeDefined();
    });

    it('should return management client secret', () => {
      expect(service.managementClientSecret).toBeDefined();
    });

    it('should check if management API is configured', () => {
      expect(typeof service.isManagementApiConfigured).toBe('boolean');
    });
  });

  describe('mobile configuration', () => {
    it('should return mobile client ID', () => {
      expect(service.mobileClientId).toBeDefined();
    });

    it('should return mobile callback URL', () => {
      expect(service.mobileCallbackUrl).toBeDefined();
    });
  });
});
