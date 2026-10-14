/** @jest-environment node */
/**
 * P-20 — Refresh token: cableado HTTP (cookies) e integración de rutas.
 * Login setea ambas cookies; /api/auth/refresh rota; logout revoca el refresh.
 */
import { NextRequest } from 'next/server';

jest.unmock('next/server');
jest.mock('@/lib/db', () => ({
  prisma: {
    usuario: { findFirst: jest.fn(), findUnique: jest.fn() },
    refreshToken: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock('@/lib/audit', () => ({
  recordAccessAttempt: jest.fn(),
  getRequestContext: jest.fn(() => ({ ip: '127.0.0.1', userAgent: 'jest' })),
}));
jest.mock('@/lib/token-revocation', () => ({
  revokeToken: jest.fn(),
  cleanupExpiredRevocations: jest.fn(),
}));

import { POST as loginPOST } from '../login/route';
import { POST as refreshPOST } from './route';
import { POST as logoutPOST } from '../logout/route';
import { AUTH_COOKIE_NAME } from '@/api/auth';
import { REFRESH_COOKIE_NAME, REFRESH_TTL_SECONDS } from '@/lib/refresh-token';
import { comparePassword, hashPassword, createJWT } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { revokeToken } from '@/lib/token-revocation';

const findFirst = prisma.usuario.findFirst as unknown as jest.Mock;
const findUnique = prisma.usuario.findUnique as unknown as jest.Mock;
const rtCreate = prisma.refreshToken.create as unknown as jest.Mock;
const rtFindMany = prisma.refreshToken.findMany as unknown as jest.Mock;
const rtUpdate = prisma.refreshToken.update as unknown as jest.Mock;
const revoke = revokeToken as unknown as jest.Mock;

let passwordHash: string;
let storedRawHash: string;
const RAW = 'raw-refresh-cookie-value';

beforeAll(async () => {
  passwordHash = await hashPassword('Secreta123');
  storedRawHash = await hashPassword(RAW);
});

beforeEach(() => {
  jest.clearAllMocks();
  rtCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'rt-new', ...data }));
  rtUpdate.mockResolvedValue({});
  revoke.mockResolvedValue(true);
});

const usuario = () => ({
  id: 'u1',
  nombre: 'Ana',
  email: 'recepcion@arnold.gym',
  password: passwordHash,
  rol: 'RECEPCIONISTA',
  estado: 'ACTIVO',
  deletedAt: null,
});

const activeRow = (over: Record<string, unknown> = {}) => ({
  id: 'rt-old',
  usuarioId: 'u1',
  tokenHash: storedRawHash,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  revokedAt: null,
  replacedByTokenId: null,
  createdAt: new Date(),
  ...over,
});

describe('POST /api/auth/login — cookies (P-20)', () => {
  it('setea ambas cookies; la de refresh es HttpOnly y la DB guarda el bcrypt (no el token crudo)', async () => {
    findFirst.mockResolvedValue(usuario());

    const res = await loginPOST(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'recepcion@arnold.gym', password: 'Secreta123' }),
      })
    );

    expect(res.status).toBe(200);
    const access = res.cookies.get(AUTH_COOKIE_NAME)!;
    const refresh = res.cookies.get(REFRESH_COOKIE_NAME)!;
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(refresh.httpOnly).toBe(true);
    expect(refresh.sameSite).toBe('strict');
    expect(refresh.path).toBe('/');
    expect(refresh.maxAge).toBe(REFRESH_TTL_SECONDS);

    const stored = rtCreate.mock.calls[0][0].data as { tokenHash: string };
    expect(refresh.value).not.toBe(stored.tokenHash);
    expect(await comparePassword(refresh.value, stored.tokenHash)).toBe(true);
  });
});

describe('POST /api/auth/refresh — rotación (P-20)', () => {
  it('con token válido rota y setea la nueva cookie de access', async () => {
    rtFindMany.mockResolvedValue([activeRow()]);
    findUnique.mockResolvedValue(usuario());

    const res = await refreshPOST(
      new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${RAW}` },
      })
    );

    expect(res.status).toBe(204);
    const access = res.cookies.get(AUTH_COOKIE_NAME)!;
    const refresh = res.cookies.get(REFRESH_COOKIE_NAME)!;
    expect(access.value).toBeTruthy();
    expect(refresh.value).toBeTruthy();
    expect(refresh.value).not.toBe(RAW);
    expect(rtUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'rt-new' },
    });
  });

  it('sin cookie de refresh → 401', async () => {
    const res = await refreshPOST(
      new NextRequest('http://localhost:3000/api/auth/refresh', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });

  it('token ya revocado (reuso) → 401', async () => {
    rtFindMany.mockResolvedValue([activeRow({ revokedAt: new Date() })]);
    const res = await refreshPOST(
      new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${RAW}` },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout — revoca refresh (P-20)', () => {
  it('revoca el refresh token y limpia la cookie', async () => {
    rtFindMany.mockResolvedValue([activeRow()]);
    const accessToken = createJWT('u1', '24h', { rol: 'RECEPCIONISTA' });

    const res = await logoutPOST(
      new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { cookie: `${AUTH_COOKIE_NAME}=${accessToken}; ${REFRESH_COOKIE_NAME}=${RAW}` },
      })
    );

    expect(res.status).toBe(200);
    expect(rtUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { revokedAt: expect.any(Date) },
    });
    const cleared = res.cookies.get(REFRESH_COOKIE_NAME)!;
    expect(cleared.value).toBe('');
    expect(cleared.maxAge).toBe(0);
  });
});
