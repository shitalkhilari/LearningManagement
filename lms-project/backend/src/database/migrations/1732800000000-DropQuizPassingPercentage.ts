import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropQuizPassingPercentage1732800000000 implements MigrationInterface {
  name = 'DropQuizPassingPercentage1732800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quizzes" DROP CONSTRAINT "CHK_quizzes_passing"`);
    await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN "passing_percentage"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quizzes" ADD "passing_percentage" integer NOT NULL DEFAULT 100`);
    await queryRunner.query(`ALTER TABLE "quizzes" ADD CONSTRAINT "CHK_quizzes_passing" CHECK ("passing_percentage" >= 1 AND "passing_percentage" <= 100)`);
  }
}
