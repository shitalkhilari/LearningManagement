# Database ER diagram

PostgreSQL schema created by `backend/src/database/migrations/1732600000000-InitialSchema.ts`. `synchronize` is false.

```mermaid
erDiagram
  users ||--o{ courses : instructs
  users ||--o{ enrollments : learns
  users ||--o{ quiz_attempts : attempts
  courses ||--o{ course_modules : contains
  courses ||--o{ enrollments : has
  courses ||--o{ quizzes : has
  course_modules ||--o{ lessons : contains
  course_modules ||--o{ quizzes : optional
  enrollments ||--o{ lesson_progress : tracks
  lessons ||--o{ lesson_progress : completed_by
  quizzes ||--o{ quiz_questions : has
  quizzes ||--o{ quiz_attempts : receives
  quiz_questions ||--o{ quiz_options : has
  quiz_questions ||--o{ quiz_responses : answered_by
  quiz_attempts ||--o{ quiz_responses : stores
  quiz_options ||--o{ quiz_responses : selected
```

## Tables

- `users` — unique email, bcrypt `password`, role `ADMIN | INSTRUCTOR | LEARNER`, `is_active`.
- `courses` — `instructor_id` references `users` and cannot be deleted while courses exist. Status is `DRAFT` or `PUBLISHED`.
- `course_modules` — unique `(course_id, sequence)`. Deleting a course cascades to its modules.
- `lessons` — unique `(module_id, sequence)`. Deleting a module cascades to its lessons.
- `enrollments` — unique `(learner_id, course_id)`. Deleting a course or learner is restricted while enrollments exist.
- `lesson_progress` — unique `(enrollment_id, lesson_id)`. A lesson cannot be deleted while progress points at it.
- `quizzes` — required `course_id`, optional `module_id`. `passing_percentage` is between 1 and 100. Removing a module sets `module_id` to null.
- `quiz_questions` and `quiz_options` — each question is expected to have exactly one correct option. That rule is enforced in `AssessmentsService`.
- `quiz_attempts` — score is stored by the server. A quiz cannot be deleted while attempts exist.
- `quiz_responses` — unique `(attempt_id, question_id)`. `is_correct` is calculated by the server when the attempt is saved.
