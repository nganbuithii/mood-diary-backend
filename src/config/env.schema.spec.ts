import { validateEnv } from './env.schema';

const BASE = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};

const DEPLOYED = {
  FRONTEND_RESET_PASSWORD_URL: 'https://mood-diary.app/reset-password',
  FRONTEND_LETTERS_URL: 'https://mood-diary.app/letters',
  FRONTEND_APP_URL: 'https://mood-diary.app',
};

describe('validateEnv', () => {
  it('allows the localhost frontend defaults outside production', () => {
    expect(validateEnv({ ...BASE, NODE_ENV: 'development' })).toMatchObject({
      FRONTEND_LETTERS_URL: 'http://localhost:3000/letters',
    });
  });

  it('accepts production with deployed frontend URLs', () => {
    expect(() => validateEnv({ ...BASE, ...DEPLOYED, NODE_ENV: 'production' })).not.toThrow();
  });

  it.each(['FRONTEND_RESET_PASSWORD_URL', 'FRONTEND_LETTERS_URL', 'FRONTEND_APP_URL'])(
    'refuses to start in production when %s is left on localhost',
    (key) => {
      const env = { ...BASE, ...DEPLOYED, NODE_ENV: 'production' } as Record<string, string>;
      delete env[key];

      expect(() => validateEnv(env)).toThrow(key);
    },
  );
});
