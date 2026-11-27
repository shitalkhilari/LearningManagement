import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1732600000000 implements MigrationInterface {
  name = 'InitialSchema1732600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password" character varying NOT NULL,
        "role" character varying(20) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "CHK_users_role" CHECK ("role" IN ('ADMIN', 'INSTRUCTOR', 'LEARNER'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "courses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "thumbnail" character varying(500),
        "instructor_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'DRAFT',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_courses_status" CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
        CONSTRAINT "FK_courses_instructor" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_courses_instructor" ON "courses" ("instructor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_courses_status" ON "courses" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "course_modules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "sequence" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_modules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_modules_course_sequence" UNIQUE ("course_id", "sequence"),
        CONSTRAINT "FK_course_modules_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_course_modules_course" ON "course_modules" ("course_id")`);

    await queryRunner.query(`
      CREATE TABLE "lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "module_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "content" text NOT NULL,
        "sequence" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lessons" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lessons_module_sequence" UNIQUE ("module_id", "sequence"),
        CONSTRAINT "FK_lessons_module" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_lessons_module" ON "lessons" ("module_id")`);

    await queryRunner.query(`
      CREATE TABLE "enrollments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "learner_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "enrolled_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_enrollments_learner_course" UNIQUE ("learner_id", "course_id"),
        CONSTRAINT "CHK_enrollments_status" CHECK ("status" IN ('ACTIVE', 'COMPLETED')),
        CONSTRAINT "FK_enrollments_learner" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_enrollments_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_enrollments_course" ON "enrollments" ("course_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_enrollments_learner" ON "enrollments" ("learner_id")`);

    await queryRunner.query(`
      CREATE TABLE "lesson_progress" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "enrollment_id" uuid NOT NULL,
        "lesson_id" uuid NOT NULL,
        "is_completed" boolean NOT NULL DEFAULT false,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_progress" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_progress_enrollment_lesson" UNIQUE ("enrollment_id", "lesson_id"),
        CONSTRAINT "FK_lesson_progress_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_progress_lesson" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "quizzes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL,
        "module_id" uuid,
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "passing_percentage" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quizzes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_quizzes_passing" CHECK ("passing_percentage" >= 1 AND "passing_percentage" <= 100),
        CONSTRAINT "FK_quizzes_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quizzes_module" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quizzes_course" ON "quizzes" ("course_id")`);

    await queryRunner.query(`
      CREATE TABLE "quiz_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quiz_id" uuid NOT NULL,
        "question_text" text NOT NULL,
        "sequence" integer NOT NULL,
        CONSTRAINT "PK_quiz_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_questions_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_questions_quiz" ON "quiz_questions" ("quiz_id")`);

    await queryRunner.query(`
      CREATE TABLE "quiz_options" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "question_id" uuid NOT NULL,
        "option_text" text NOT NULL,
        "is_correct" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_quiz_options" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_options_question" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_options_question" ON "quiz_options" ("question_id")`);

    await queryRunner.query(`
      CREATE TABLE "quiz_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quiz_id" uuid NOT NULL,
        "learner_id" uuid NOT NULL,
        "score" integer NOT NULL,
        "total_questions" integer NOT NULL,
        "percentage" numeric(5,2) NOT NULL,
        "status" character varying(10) NOT NULL,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_quiz_attempts_status" CHECK ("status" IN ('PASS', 'FAIL')),
        CONSTRAINT "FK_quiz_attempts_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_attempts_learner" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_attempts_quiz" ON "quiz_attempts" ("quiz_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_quiz_attempts_learner" ON "quiz_attempts" ("learner_id")`);

    await queryRunner.query(`
      CREATE TABLE "quiz_responses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "attempt_id" uuid NOT NULL,
        "question_id" uuid NOT NULL,
        "selected_option_id" uuid NOT NULL,
        "is_correct" boolean NOT NULL,
        CONSTRAINT "PK_quiz_responses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quiz_responses_attempt_question" UNIQUE ("attempt_id", "question_id"),
        CONSTRAINT "FK_quiz_responses_attempt" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quiz_responses_question" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_quiz_responses_option" FOREIGN KEY ("selected_option_id") REFERENCES "quiz_options"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quizzes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "enrollments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lessons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_modules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
