import { MigrationInterface, QueryRunner } from 'typeorm';

const SAMPLE_VIDEOS = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  'https://download.samplelib.com/mp4/sample-5s.mp4',
  'https://download.samplelib.com/mp4/sample-10s.mp4',
];

export class LessonVideoUrl1732700000000 implements MigrationInterface {
  name = 'LessonVideoUrl1732700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lessons" ADD "video_url" character varying(500)`);
    const caseSql = SAMPLE_VIDEOS.map(
      (url, index) => `WHEN ${(index + 1) % SAMPLE_VIDEOS.length} THEN '${url}'`,
    ).join(' ');
    await queryRunner.query(`
      WITH numbered AS (
        SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS n
        FROM "lessons"
      )
      UPDATE "lessons"
      SET "video_url" = CASE (numbered.n % ${SAMPLE_VIDEOS.length}) ${caseSql} END
      FROM numbered
      WHERE "lessons"."id" = numbered."id"
    `);
    await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "video_url" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "video_url"`);
  }
}
