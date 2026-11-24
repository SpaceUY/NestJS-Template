import { CardResolver } from '../card-resolver';

export class MockCardResolver extends CardResolver {
  findForUser = jest.fn().mockResolvedValue(null);
  findByExternalId = jest.fn().mockResolvedValue(null);
}
