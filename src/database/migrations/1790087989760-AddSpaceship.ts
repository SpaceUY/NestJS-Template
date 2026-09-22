import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceship1790087989760 implements MigrationInterface {
  name = 'AddSpaceship1790087989760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "spaceship" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "fleet" character varying NOT NULL, "captainId" integer NOT NULL, CONSTRAINT "UQ_fc4d9ddc87667d5324879c9cd54" UNIQUE ("uuid"), CONSTRAINT "UQ_9402cc904dd12282fc9b444aece" UNIQUE ("captainId"), CONSTRAINT "REL_9402cc904dd12282fc9b444aec" UNIQUE ("captainId"), CONSTRAINT "PK_94ee6cf32be536f1af15ed80716" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "spaceship" ADD CONSTRAINT "FK_9402cc904dd12282fc9b444aece" FOREIGN KEY ("captainId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "spaceship" DROP CONSTRAINT "FK_9402cc904dd12282fc9b444aece"`,
    );
    await queryRunner.query(`DROP TABLE "spaceship"`);
  }
}
