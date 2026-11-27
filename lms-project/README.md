# eLearning Management System

A local NestJS and React learning-management application for the NestJS eLearning assignment. Learners enroll in published courses, complete lessons, and submit quizzes. Instructors manage their own courses. Admins manage users and can see every course.

## Technology stack

- Backend: NestJS, TypeScript, PostgreSQL, TypeORM, JWT, Passport, bcrypt, class-validator, Swagger
- Frontend: React, Vite, TypeScript, Material UI, Axios, React Router
- Tests: Jest and Supertest
- Local services: Docker Compose

## Architecture

The React app calls the NestJS API with a JWT. Guards check the token and the role. Services hold the business rules. TypeORM repositories talk to PostgreSQL. Schema changes go through migrations (`synchronize` is false).

```
lms-project/
  backend/        NestJS API
  frontend/       React UI
  database/seeds/ Sample user list used by the seed script
  documentation/  ER diagram and learning notes
  postman/        API collection
  docker-compose.yml
```

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 16 (or Docker, which starts PostgreSQL for you)

## Environment

Copy the examples and adjust them if your database password is different.

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Backend variables: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_NAME_TEST`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`.

Frontend variable: `VITE_API_URL=http://localhost:3000/api`.

## Database setup

Create the database, then run migrations from `backend`:

```bash
npm install
npm run migration:run
npm run seed
```

`npm run migration:run` applies `src/database/migrations/1732600000000-InitialSchema.ts`.

`npm run seed` inserts the sample users, courses, modules, lessons, quizzes, enrollments, and one completed lesson. It skips itself if the users table already has rows. Passwords are stored as bcrypt hashes.

## Run without Docker

In one terminal:

```bash
cd backend
npm run start:dev
```

In another:

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs

## Docker Compose

From `lms-project`:

```bash
docker compose up --build
```

PostgreSQL starts first and must pass its health check. The backend then runs migrations and starts in watch mode. The frontend starts Vite on port 5173.

Seed the database after the first startup:

```bash
docker compose exec backend npm run seed
```

Stop everything:

```bash
docker compose down
```

The database files stay in the named volume `lms_postgres`.

## Sample accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@lms.local | Admin@123 |
| Instructor | instructor1@lms.local | Instructor@123 |
| Instructor | instructor2@lms.local | Instructor@123 |
| Learner | learner1@lms.local | Learner@123 |
| Learner | learner2@lms.local | Learner@123 |
| Learner | learner3@lms.local | Learner@123 |

Public registration always creates a learner. An admin creates instructor accounts from the Users screen.

## Tests and coverage

From `backend`:

```bash
npm test
npm run test:cov
npm run test:e2e
```

`npm run test:cov` writes `backend/coverage/lcov-report/index.html`. Open that file in a browser. The e2e test uses `DB_NAME_TEST` (default `lms_test`) and needs PostgreSQL to be running. Create that database before `npm run test:e2e`.

## Main API groups

Authentication, Users, Courses, Modules, Lessons, Enrollments, Progress, Assessments, and Reports. The Postman collection in `postman/LMS.postman_collection.json` calls them in workflow order.
