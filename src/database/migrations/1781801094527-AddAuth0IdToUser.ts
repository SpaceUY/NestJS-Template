import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuth0IdToUser1781801094527 implements MigrationInterface {
    name = 'AddAuth0IdToUser1781801094527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_authtype_enum" AS ENUM('EMAIL', 'GOOGLE', 'AUTH0')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "email" character varying NOT NULL, "verified" boolean NOT NULL DEFAULT false, "authType" "public"."user_authtype_enum" NOT NULL DEFAULT 'EMAIL', "auth0Id" character varying, CONSTRAINT "UQ_a95e949168be7b7ece1a2382fed" UNIQUE ("uuid"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_49c08de80c2fd2f6a7ba5ce97c4" UNIQUE ("auth0Id"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "spaceship" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "fleet" character varying NOT NULL, "captainId" integer NOT NULL, CONSTRAINT "UQ_fc4d9ddc87667d5324879c9cd54" UNIQUE ("uuid"), CONSTRAINT "UQ_9402cc904dd12282fc9b444aece" UNIQUE ("captainId"), CONSTRAINT "REL_9402cc904dd12282fc9b444aec" UNIQUE ("captainId"), CONSTRAINT "PK_94ee6cf32be536f1af15ed80716" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "spaceship" ADD CONSTRAINT "FK_9402cc904dd12282fc9b444aece" FOREIGN KEY ("captainId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaceship" DROP CONSTRAINT "FK_9402cc904dd12282fc9b444aece"`);
        await queryRunner.query(`DROP TABLE "spaceship"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_authtype_enum"`);
    }

}
