import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletProvisioning1795033997324 implements MigrationInterface {
  name = 'AddWalletProvisioning1795033997324';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wallet_provisioning" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userUuid" character varying NOT NULL, "cardUuid" character varying NOT NULL, "cardExternalId" character varying NOT NULL, "lastFour" character varying(4) NOT NULL, "wallet" character varying(16) NOT NULL, "tokenExternalId" character varying, "status" character varying(16) NOT NULL, "statusReason" character varying, CONSTRAINT "UQ_6887fe796d13424734fe600acaf" UNIQUE ("uuid"), CONSTRAINT "PK_28d96b478b3a8147f65d29f4025" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_provisioning_user_uuid" ON "wallet_provisioning"  ("userUuid") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_provisioning_card_uuid" ON "wallet_provisioning"  ("cardUuid") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_wallet_provisioning_token_external_id" ON "wallet_provisioning"  ("tokenExternalId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_117ad326f2881bc6b4ecf7ee8d" ON "wallet_provisioning"  ("cardExternalId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5335347f687b8f0b768ed6bde8" ON "wallet_provisioning"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e5c216a620016788347b0fc0b1" ON "wallet_provisioning"  ("createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e5c216a620016788347b0fc0b1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5335347f687b8f0b768ed6bde8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_117ad326f2881bc6b4ecf7ee8d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_wallet_provisioning_token_external_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_wallet_provisioning_card_uuid"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_wallet_provisioning_user_uuid"`,
    );
    await queryRunner.query(`DROP TABLE "wallet_provisioning"`);
  }
}
