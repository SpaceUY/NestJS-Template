import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { RateLimitModule } from './rate-limit.module';
import { skipUnthrottledPath } from './rate-limit-skip.util';

// Stand-ins for src/health/health.controller.ts, mounted at the same paths.
// The real controller is not imported: src/common/ may not depend on a
// feature module, and what is under test is the path rule, not Terminus.
@Controller('health')
class StandInHealthController {
  @Get()
  readiness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('live')
  liveness(): { status: string } {
    return { status: 'ok' };
  }
}

@Controller('auth/auth0')
class StandInAuthController {
  @Get('login')
  login(): { token: string } {
    return { token: 'a-token' };
  }
}

const LIMIT = 3;

// RateLimitModule is the only thing that binds ThrottlerGuard to every route,
// so this spec boots a real app the way middleware.module.unit.spec.ts does:
// the guard and the skip predicate each have their own unit coverage, and
// what no unit test can show is that the binding actually happens and that
// the health routes come out the other side uncounted.
describe('RateLimitModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: LIMIT }],
          skipIf: skipUnthrottledPath,
        }),
        RateLimitModule,
      ],
      controllers: [StandInHealthController, StandInAuthController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('limits a public auth route once the window allowance is spent', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt += 1) {
      const allowed = await request(app.getHttpServer()).get(
        '/auth/auth0/login',
      );
      expect(allowed.status).toBe(200);
    }

    const blocked = await request(app.getHttpServer()).get('/auth/auth0/login');
    expect(blocked.status).toBe(429);
  });

  // The regression this exists to catch: a load balancer polling every 30
  // seconds burns the allowance in minutes, starts reading 429 and pulls
  // healthy instances out of rotation. Well past the limit, both probes must
  // still answer 200.
  it('never limits the readiness probe', async () => {
    for (let attempt = 0; attempt < LIMIT * 4; attempt += 1) {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('never limits the liveness probe', async () => {
    for (let attempt = 0; attempt < LIMIT * 4; attempt += 1) {
      const res = await request(app.getHttpServer()).get('/health/live');
      expect(res.status).toBe(200);
    }
  });

  // A skipped route must not consume the allowance either, or the probes
  // would throttle the real traffic instead of themselves.
  it('does not count a health probe against another route', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: LIMIT }],
          skipIf: skipUnthrottledPath,
        }),
        RateLimitModule,
      ],
      controllers: [StandInHealthController, StandInAuthController],
    }).compile();

    const isolated = moduleRef.createNestApplication();
    await isolated.init();

    for (let attempt = 0; attempt < LIMIT * 4; attempt += 1) {
      await request(isolated.getHttpServer()).get('/health');
    }

    const res = await request(isolated.getHttpServer()).get(
      '/auth/auth0/login',
    );
    expect(res.status).toBe(200);

    await isolated.close();
  });

  // What src/app.module.ts does for RATE_LIMIT_ENABLED=false: fold the
  // disabled check into skipIf rather than removing RateLimitModule, so the
  // guard stays bound and simply never blocks.
  it('never limits anything once skipIf is forced true', async () => {
    const enabled = false;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60_000, limit: LIMIT }],
          skipIf: (context) => !enabled || skipUnthrottledPath(context),
        }),
        RateLimitModule,
      ],
      controllers: [StandInAuthController],
    }).compile();

    const disabled = moduleRef.createNestApplication();
    await disabled.init();

    for (let attempt = 0; attempt < LIMIT * 4; attempt += 1) {
      const res = await request(disabled.getHttpServer()).get(
        '/auth/auth0/login',
      );
      expect(res.status).toBe(200);
    }

    await disabled.close();
  });
});
