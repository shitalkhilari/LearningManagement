# Test coverage report

Unit tests use Jest with `ts-jest`. HTTP-level validation uses Nest's `ValidationPipe` directly. The end-to-end workflow uses Supertest against a Nest application and PostgreSQL (`DB_NAME_TEST`, default `lms_test`).

Configuration lives in the `jest` section of `backend/package.json`. Unit tests match `*.spec.ts` under `backend/src`. The e2e suite uses `backend/test/jest-e2e.json` and matches `*.e2e-spec.ts`.

`npm test` and `npm run test:cov` pass `--runInBand`. On Node 26, Jest's worker processes exited with a zone allocation failure before any test ran. One process avoids that failure. `--forceExit` is set because a handle otherwise keeps the unit process alive after the suites finish.

## Initial coverage

Measured before this work, with the previous `collectCoverageFrom` list (service classes, `progress.calculator.ts`, and `quiz-scoring.ts` only). 11 suites, 64 tests, all passing.

| Metric | Covered | Total | Percentage |
| --- | ---: | ---: | ---: |
| Statements | 642 | 761 | 84.36% |
| Branches | 133 | 239 | 55.64% |
| Functions | 116 | 129 | 89.92% |
| Lines | 608 | 720 | 84.44% |

Statements, branches, and lines were below the target. The largest gap was branch coverage in courses, lessons, assessments, enrollments, reports, and progress. Controllers, guards, the exception filter, the logging interceptor, the JWT strategy, pagination, and configuration were not part of the report.

## Final coverage

Measured after the new tests, on a wider set: the original files plus controllers, guards, the exception filter, the logging interceptor, decorators, pagination, configuration, and the JWT strategy. 30 unit suites, 154 tests, all passing. The existing e2e workflow also passed.

| Metric | Covered | Total | Percentage | Target |
| --- | ---: | ---: | ---: | ---: |
| Statements | 1088 | 1088 | 100% | 85% |
| Branches | 282 | 287 | 98.25% | 80% |
| Functions | 201 | 201 | 100% | 85% |
| Lines | 1015 | 1015 | 100% | 85% |

`npm run test:cov` enforces those targets through Jest `coverageThreshold`.

## Comparison

The final run measures more files than the initial run, and the percentages are still higher.

| Metric | Initial | Final | Change |
| --- | ---: | ---: | ---: |
| Statements | 84.36% | 100% | +15.64 points |
| Branches | 55.64% | 98.25% | +42.61 points |
| Functions | 89.92% | 100% | +10.08 points |
| Lines | 84.44% | 100% | +15.56 points |

## Modules and components covered

- Auth: registration always creates a learner, login failures, inactive accounts, token payload, JWT validation, controller delegation
- Users: create, list, update, duplicate email, role counts
- Courses: visibility by role, publish rules, instructor reassignment, delete blocked by enrollments or attempts
- Modules and lessons: sequencing, reorder validation, enrollment checks, delete blocked by progress
- Enrollments: learners only, duplicates, unpublished courses, list scope by role
- Progress: completion, quiz passes in the percentage, authorization
- Assessments: scoring, hidden correct answers, option rules, attempt visibility
- Reports: admin, instructor, and learner dashboards, date and status filters, quiz summary
- Shared: `RolesGuard`, `JwtAuthGuard`, `AllExceptionsFilter`, `LoggingInterceptor`, `CurrentUser`, `Roles`, `paginate`, environment configuration
- Request validation for registration, courses, lessons, questions, quiz submission, and pagination

## Additional test cases

New files:

- `backend/src/common/utils/pagination.spec.ts`
- `backend/src/common/guards/roles.guard.spec.ts`
- `backend/src/common/guards/jwt-auth.guard.spec.ts`
- `backend/src/common/filters/all-exceptions.filter.spec.ts`
- `backend/src/common/interceptors/logging.interceptor.spec.ts`
- `backend/src/common/decorators/roles.decorator.spec.ts`
- `backend/src/common/decorators/current-user.decorator.spec.ts`
- `backend/src/common/dto/validation.spec.ts`
- `backend/src/config/configuration.spec.ts`
- `backend/src/modules/auth/strategies/jwt.strategy.spec.ts`
- `backend/src/modules/auth/auth.controller.spec.ts`
- `backend/src/modules/users/users.controller.spec.ts`
- `backend/src/modules/courses/courses.controller.spec.ts`
- `backend/src/modules/modules/modules.controller.spec.ts`
- `backend/src/modules/lessons/lessons.controller.spec.ts`
- `backend/src/modules/enrollments/enrollments.controller.spec.ts`
- `backend/src/modules/progress/progress.controller.spec.ts`
- `backend/src/modules/assessments/assessments.controller.spec.ts`
- `backend/src/modules/reports/reports.controller.spec.ts`

Extended existing service and scoring specs:

- `backend/src/modules/users/users.service.spec.ts`
- `backend/src/modules/courses/courses.service.spec.ts`
- `backend/src/modules/modules/modules.service.spec.ts`
- `backend/src/modules/lessons/lessons.service.spec.ts`
- `backend/src/modules/enrollments/enrollments.service.spec.ts`
- `backend/src/modules/progress/progress.service.spec.ts`
- `backend/src/modules/progress/progress.calculator.spec.ts`
- `backend/src/modules/assessments/assessments.service.spec.ts`
- `backend/src/modules/assessments/quiz-scoring.spec.ts`
- `backend/src/modules/reports/reports.service.spec.ts`

No production business rules were changed. `backend/package.json` now collects the wider file set, runs Jest in one process, and fails `test:cov` below the targets.

## Edge cases covered

- Unknown email, wrong password, and inactive account at login and in the JWT strategy
- Duplicate email, same-email update, and role counts when a role has no users
- Learner forced onto published courses, instructor draft ownership, admin filters
- Publish blocked for a blank title or a course with no module
- Delete blocked when enrollments, quiz attempts, lesson progress, or question responses exist
- Reorder rejected for a partial list, duplicates, or an id from another parent
- Enrollment rejected for staff, an unpublished course, and a second enrollment
- Lesson completion rejected for staff, a missing lesson, an unpublished course, and a learner who is not enrolled
- Progress stays active until required quizzes are passed; quiz id columns `quizId`, `quizid`, and `quiz_id` are all read
- Quiz scoring clamps out-of-range counts and fails a quiz with no questions
- Correct options are removed from learner quiz payloads
- A question must have four options and exactly one correct option
- Duplicate answers and incomplete submissions are rejected
- Learners cannot read another learner's enrollment, progress, or attempt; instructors cannot read another instructor's course data
- Unique-key (`23505`) and foreign-key (`23503`) database errors become HTTP 409; other failures stay HTTP 500
- Pagination page and limit are clamped to page >= 1 and limit 1..100
- Registration rejects a client-supplied role, a short password, and an invalid email

## Remaining uncovered areas

Five defensive branches are still uncovered. Statements, functions, and lines on the measured files are fully covered.

- `assessments.service.ts` line 216: `quiz.questions ?? []` inside `submit`. `loadQuiz` already replaces a missing question list with an array, so this arm is not reachable on the submit path.
- `assessments.service.ts` lines 243, 336, and 400: `questions ?? []` or `options ?? []` when a relation is null. The tests cover missing quizzes, empty question lists, and a selected option that is not on the question. The null-relation arm is the same failure or an empty list.
- `courses.service.ts` line 94: `course.modules ?? []` when the modules relation itself is null. Sorting an empty lesson list on a present module is tested.

These files are intentionally outside the coverage percentage. They are not omitted to raise the number. The previous service files stayed in the report, and the new list added application code.

| Area | Why it is not in the percentage |
| --- | --- |
| `*.module.ts` | Nest dependency-injection wiring |
| `*.entity.ts` | TypeORM column metadata |
| `dto/*.ts` | class-validator metadata. Representative DTOs are validated in `validation.spec.ts`. The e2e suite also sends invalid registration bodies. |
| `database/migrations`, `database/seed.ts`, `database/data-source.ts` | Schema setup and sample data, not request handling |
| `main.ts` | Process bootstrap, CORS, Swagger, and `listen`. The pipes, filter, and interceptor it installs are unit tested. The e2e app boots the same stack. |
| Enums and interfaces | Constants and types, with no branching behavior |

## Commands

From `backend`:

```bash
npm test
npm run test:cov
npm run test:e2e
```

`npm run test:cov` writes `backend/coverage/lcov-report/index.html`.

`npm run test:e2e` needs PostgreSQL and a database named by `DB_NAME_TEST`. The spec truncates that database. Do not point it at the development database.

`npm run build` compiles the API with the Nest CLI. It succeeded after these tests were added.

## Recommendations

- Add or extend a unit spec in the same change as a new service branch, guard, or controller method.
- Keep the coverage threshold at the agreed floor (85% statements, functions, and lines; 80% branches). Do not lower it to make a change pass, and do not drop application files from `collectCoverageFrom` to clear the threshold.
- Prefer asserting the returned value or the thrown exception. A test that only calls a method does not protect the behavior.
- Mock repositories and external services. Leave scoring, visibility, and validation rules real.
- Run `npm run test:cov` before merging. Run `npm run test:e2e` when a change crosses module boundaries and PostgreSQL is available.
- Keep each test independent. Reset mocks in `beforeEach`, and do not rely on suite order.
