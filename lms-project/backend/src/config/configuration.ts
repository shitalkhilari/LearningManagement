export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'lms',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-local-env',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});
