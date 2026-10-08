/** @jest-environment node */
import { NextRequest } from 'next/server';
import { handleLoginRequest, AUTH_COOKIE_NAME } from '@/api/auth';

jest.unmock('next/server');
jest.mock('@/lib/db', () => ({ prisma: {} }));
jest.mock('@/api/auth', () => ({
  ...jest.requireActual('@/api/auth'),
  handleLoginRequest: jest.fn(),
}));
const mockLogin = handleLoginRequest as jest.Mock;

import { POST as loginPOST } from './route';
import { POST as logoutPOST } from '../logout/route';

const req = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('POST /api/auth/login', () => {
  beforeEach(() => mockLogin.mockReset());

  it('le pasa al handler el cuerpo y el contexto (IP y user-agent) para la auditoría', async () => {
    mockLogin.mockResolvedValue({ status: 401, body: { code: 'AUTH_INVALID', message: 'x', recoverable: true } });
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
      headers: { 'user-agent': 'UA-test', 'x-forwarded-for': '7.7.7.7' },
    });
    await loginPOST(request);
    expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.c', password: 'x' }, { ip: '7.7.7.7', userAgent: 'UA-test' });
  });

  it('200: setea la cookie de sesión con los flags del spec', async () => {
    mockLogin.mockResolvedValue({ status: 200, token: 'jwt-x', body: { success: true, role: 'RECEPCIONISTA' } });
    const res = await loginPOST(req({ email: 'a@b.c', password: 'x' }));

    expect(res.status).toBe(200);
    expect(await res.clone().json()).toEqual({ success: true, role: 'RECEPCIONISTA' });
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toContain(`${AUTH_COOKIE_NAME}=jwt-x`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    expect(cookie).toMatch(/Max-Age=86400/i);
    expect(cookie).toMatch(/Path=\//);
  });

  it.each([
    [401, 'AUTH_INVALID'],
    [403, 'AUTH_DISABLED'],
    [400, 'VALIDATION_ERROR'],
  ])('%i %s: no setea cookie', async (status, code) => {
    mockLogin.mockResolvedValue({ status, body: { code, message: 'm', recoverable: true } });
    const res = await loginPOST(req({ email: 'a@b.c', password: 'x' }));
    expect(res.status).toBe(status);
    expect((await res.clone().json()).code).toBe(code);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('body no-JSON → pasa null al handler (400, no 500)', async () => {
    mockLogin.mockResolvedValue({ status: 400, body: { code: 'VALIDATION_ERROR', message: 'm', recoverable: true } });
    const bad = new NextRequest('http://localhost:3000/api/auth/login', { method: 'POST', body: 'no-json' });
    const res = await loginPOST(bad);
    expect(mockLogin).toHaveBeenCalledWith(null, expect.objectContaining({ ip: expect.any(String), userAgent: expect.any(String) }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('200: borra la cookie (valor vacío, Max-Age=0)', async () => {
    const res = await logoutPOST(new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(new RegExp(`${AUTH_COOKIE_NAME}=;`));
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});
