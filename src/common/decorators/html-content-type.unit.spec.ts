import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Html } from './html-content-type';

@Controller('pages')
class PagesController {
  @Get('html')
  @Html()
  html(): string {
    return '<p>hi</p>';
  }

  @Get('json')
  json(): { ok: boolean } {
    return { ok: true };
  }
}

describe('@Html()', () => {
  it('sets text/html on the decorated handler only', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PagesController],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const html = await request(app.getHttpServer()).get('/pages/html');
    const json = await request(app.getHttpServer()).get('/pages/json');

    expect(html.headers['content-type']).toContain('text/html');
    expect(json.headers['content-type']).toContain('application/json');

    await app.close();
  });
});
