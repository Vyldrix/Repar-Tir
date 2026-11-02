import { beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { clearRateLimits } from '../../src/middlewares/rate-limit.middleware.js';
import prisma from '../../src/lib/prisma.js';

export interface TestUserCredentials {
  username: string;
  email: string;
  password: string;
}

export async function cleanDatabase(): Promise<void> {
  await prisma.list.deleteMany();
  await prisma.user.deleteMany();
}

export function registerStandardTestHooks(): void {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(() => {
    clearRateLimits();
  });
}

export async function registerAndLoginUser(user: TestUserCredentials): Promise<{
  token: string;
  refreshToken: string;
  userId: string;
}> {
  const regRes = await request(app).post('/api/auth/register').send(user);
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });

  return {
    token: loginRes.body.token,
    refreshToken: loginRes.body.refreshToken,
    userId: regRes.body?.id ?? loginRes.body?.user?.id ?? '',
  };
}
