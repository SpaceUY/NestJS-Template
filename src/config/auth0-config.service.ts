import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import auth0Config from './auth0.config';

@Injectable()
export class Auth0ConfigService {
  constructor(
    @Inject(auth0Config.KEY)
    private readonly auth0Conf: ConfigType<typeof auth0Config>,
  ) {}

  /**
   * Get the complete Auth0 configuration object
   */
  get config(): ConfigType<typeof auth0Config> {
    return this.auth0Conf;
  }

  /**
   * Get Auth0 domain
   */
  get domain(): string {
    return this.auth0Conf.domain;
  }

  /**
   * Get Auth0 client ID for web application
   */
  get clientId(): string {
    return this.auth0Conf.clientId;
  }

  /**
   * Get Auth0 client secret for web application
   */
  get clientSecret(): string {
    return this.auth0Conf.clientSecret;
  }

  /**
   * Get Auth0 API audience
   */
  get audience(): string {
    return this.auth0Conf.audience;
  }

  /**
   * Get Auth0 mobile client ID
   */
  get mobileClientId(): string {
    return this.auth0Conf.mobileClientId;
  }

  /**
   * Get Auth0 issuer URL
   */
  get issuer(): string {
    return this.auth0Conf.issuer;
  }

  /**
   * Get JWT signing algorithm
   */
  get algorithm(): string {
    return this.auth0Conf.algorithm;
  }

  /**
   * Get callback URL for web application
   */
  get callbackUrl(): string {
    return this.auth0Conf.callbackUrl;
  }

  /**
   * Get logout URL for web application
   */
  get logoutUrl(): string {
    return this.auth0Conf.logoutUrl;
  }

  /**
   * Get mobile callback URL
   */
  get mobileCallbackUrl(): string {
    return this.auth0Conf.mobileCallbackUrl;
  }

  /**
   * Get token expiration time in seconds
   */
  get tokenExpiration(): number {
    return this.auth0Conf.tokenExpiration;
  }

  /**
   * Check if refresh token rotation is enabled
   */
  get refreshTokenRotation(): boolean {
    return this.auth0Conf.refreshTokenRotation;
  }

  /**
   * Check if debug mode is enabled
   */
  get debug(): boolean {
    return this.auth0Conf.debug;
  }

  /**
   * Get log level
   */
  get logLevel(): string {
    return this.auth0Conf.logLevel;
  }

  /**
   * Get Management API client ID
   */
  get managementClientId(): string {
    return this.auth0Conf.managementClientId;
  }

  /**
   * Get Management API client secret
   */
  get managementClientSecret(): string {
    return this.auth0Conf.managementClientSecret;
  }

  /**
   * Check if Management API is configured
   */
  get isManagementApiConfigured(): boolean {
    return !!(
      this.auth0Conf.managementClientId && this.auth0Conf.managementClientSecret
    );
  }

  /**
   * Get JWKS URI for JWT validation
   */
  get jwksUri(): string {
    return `https://${this.auth0Conf.domain}/.well-known/jwks.json`;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  get authorizationUrl(): string {
    return `https://${this.auth0Conf.domain}/authorize`;
  }

  /**
   * Get token URL for OAuth flow
   */
  get tokenUrl(): string {
    return `https://${this.auth0Conf.domain}/oauth/token`;
  }

  /**
   * Get user info URL
   */
  get userInfoUrl(): string {
    return `https://${this.auth0Conf.domain}/userinfo`;
  }

  /**
   * Get logout URL for Auth0 logout
   */
  get auth0LogoutUrl(): string {
    return `https://${this.auth0Conf.domain}/v2/logout`;
  }
}
