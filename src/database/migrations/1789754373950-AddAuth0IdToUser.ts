import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuth0IdToUser1789754373950 implements MigrationInterface {
  name = 'AddAuth0IdToUser1789754373950';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "auth0Id" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_49c08de80c2fd2f6a7ba5ce97c4" UNIQUE ("auth0Id")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."user_authtype_enum" ADD VALUE 'AUTH0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_authtype_enum_old" AS ENUM('EMAIL', 'GOOGLE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "authType" TYPE "public"."user_authtype_enum_old" USING "authType"::"text"::"public"."user_authtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_authtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_authtype_enum_old" RENAME TO "user_authtype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_49c08de80c2fd2f6a7ba5ce97c4"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "auth0Id"`);
  }
}
