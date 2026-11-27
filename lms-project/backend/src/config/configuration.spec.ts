import configuration from './configuration';

describe('configuration', () => {
  const keys = [
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'CORS_ORIGIN',
  ] as const;
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    saved.clear();
    for (const key of keys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = saved.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('falls back to local defaults', () => {
    expect(configuration()).toEqual({
      port: 3000,
      database: {
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        name: 'lms',
      },
      jwt: {
        secret: 'change-me-in-local-env',
        expiresIn: '1d',
      },
      corsOrigin: 'http://localhost:5173',
    });
  });

  it('reads overrides from the environment', () => {
    process.env.PORT = '4000';
    process.env.DB_HOST = 'db';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'lms';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_NAME = 'lms_test';
    process.env.JWT_SECRET = 'jwt-secret';
    process.env.JWT_EXPIRES_IN = '2h';
    process.env.CORS_ORIGIN = 'http://localhost:4173';

    expect(configuration()).toEqual({
      port: 4000,
      database: {
        host: 'db',
        port: 5433,
        username: 'lms',
        password: 'secret',
        name: 'lms_test',
      },
      jwt: {
        secret: 'jwt-secret',
        expiresIn: '2h',
      },
      corsOrigin: 'http://localhost:4173',
    });
  });
});
