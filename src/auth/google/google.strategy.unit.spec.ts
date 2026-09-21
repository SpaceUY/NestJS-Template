import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VerifyCallback } from 'passport-google-oauth20';
import { User } from '../../database/entities/user.entity';
import { AuthType } from '../../database/entities/auth-type.enum';
import { googleScope } from './config/google.scope';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const googleConf = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    callbackUrl: 'https://api.example.com/auth/google/callback',
    audience: 'audience-id',
  };

  const profile = {
    emails: [{ value: 'astro@example.com' }],
    name: { givenName: 'Astro', familyName: 'Naut' },
  };

  /** Collects what the passport callback was handed. */
  const capture = (): {
    done: VerifyCallback;
    calls: Array<[unknown, unknown]>;
  } => {
    const calls: Array<[unknown, unknown]> = [];
    const done = ((err: unknown, user?: unknown) => {
      calls.push([err, user]);
    }) as VerifyCallback;
    return { done, calls };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: googleScope.KEY, useValue: googleConf },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hands back the existing user without writing to the database', async () => {
    const existing = { uuid: 'uuid' } as User;
    mockUserRepository.findOne.mockResolvedValue(existing);
    const { done, calls } = capture();

    await strategy.validate('access', 'refresh', profile, done);

    expect(calls).toEqual([[null, existing]]);
    expect(mockUserRepository.save).not.toHaveBeenCalled();
  });

  it('creates a verified Google user on first sign-in', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    const created = { uuid: 'new-uuid' } as User;
    mockUserRepository.create.mockReturnValue(created);
    mockUserRepository.save.mockResolvedValue(created);
    const { done, calls } = capture();

    await strategy.validate('access', 'refresh', profile, done);

    expect(mockUserRepository.create).toHaveBeenCalledWith({
      email: 'astro@example.com',
      name: 'Astro Naut',
      verified: true,
      authType: AuthType.GOOGLE,
    });
    expect(mockUserRepository.save).toHaveBeenCalledWith(created);
    expect(calls).toEqual([[null, created]]);
  });

  it('passes a repository failure to the callback instead of throwing', async () => {
    const error = new Error('connection lost');
    mockUserRepository.findOne.mockRejectedValue(error);
    const { done, calls } = capture();

    await expect(
      strategy.validate('access', 'refresh', profile, done),
    ).resolves.toBeUndefined();

    expect(calls).toEqual([[error, undefined]]);
  });
});
