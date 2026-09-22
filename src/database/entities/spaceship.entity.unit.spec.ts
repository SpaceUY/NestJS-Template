import { getMetadataArgsStorage } from 'typeorm';
import { Spaceship } from './spaceship.entity';
import { User } from './user.entity';

/**
 * A one-to-one relation is declared twice — owning side and inverse side —
 * and the two halves are only checked against each other when TypeORM builds
 * its metadata, which happens against a live database. A selector pointing at
 * the wrong property compiles, passes every unit test that mocks the
 * repository, and fails at connection time. These assertions run the
 * selectors instead.
 */
type RelationArgs = ReturnType<
  typeof getMetadataArgsStorage
>['relations'][number];

const relationOf = (target: object, propertyName: string): RelationArgs => {
  const relation = getMetadataArgsStorage().relations.find(
    (candidate) =>
      candidate.target === target && candidate.propertyName === propertyName,
  );
  if (!relation) {
    throw new Error(`No relation metadata for ${propertyName}`);
  }
  return relation;
};

describe('Spaceship ↔ User relation', () => {
  it('points the owning side at User, through the captain property', () => {
    const relation = relationOf(Spaceship, 'captain');

    expect(relation.relationType).toBe('one-to-one');
    expect((relation.type as () => unknown)()).toBe(User);
    expect(
      (relation.inverseSideProperty as (user: User) => unknown)({
        ship: 'the-inverse-side',
      } as unknown as User),
    ).toBe('the-inverse-side');
  });

  it('points the inverse side back at Spaceship, through the ship property', () => {
    const relation = relationOf(User, 'ship');

    expect(relation.relationType).toBe('one-to-one');
    expect((relation.type as () => unknown)()).toBe(Spaceship);
    expect(
      (relation.inverseSideProperty as (spaceship: Spaceship) => unknown)({
        captain: 'the-owning-side',
      } as unknown as Spaceship),
    ).toBe('the-owning-side');
  });

  // The FK column is what makes `captainId` readable without loading the
  // relation, and `unique` is what makes one captain own at most one ship —
  // the constraint the repository translates into a 409.
  it('owns a unique captainId foreign-key column', () => {
    const column = getMetadataArgsStorage().columns.find(
      (candidate) =>
        candidate.target === Spaceship &&
        candidate.propertyName === 'captainId',
    );

    expect(column?.options.name).toBe('captainId');
    expect(column?.options.unique).toBe(true);
  });
});
