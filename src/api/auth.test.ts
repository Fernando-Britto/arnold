import { handleLoginRequest } from './auth';
import { hashPassword, verifyJWT } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAccessAttempt } from '@/lib/audit';

jest.mock('@/lib/db', () => ({ prisma: { usuario: { findFirst: jest.fn() } } }));
jest.mock('@/lib/audit', () => ({ recordAccessAttempt: jest.fn() }));
const audit = recordAccessAttempt as jest.Mock;
const ctx = { ip: '1.2.3.4', userAgent: 'UA' };
const findFirst = prisma.usuario.findFirst as jest.Mock;

let hash: string;
beforeAll(async () => { hash = await hashPassword('Secreta123'); });
beforeEach(() => { findFirst.mockReset(); audit.mockReset(); });

const usuario = (over = {}) => ({
  id: 'u1', nombre: 'Ana', email: 'recepcion@arnold.gym',
  password: hash, rol: 'RECEPCIONISTA', estado: 'ACTIVO', deletedAt: null, ...over,
});

describe('handleLoginRequest', () => {
  it.each([null, {}, { email: 'a@b.c' }, { password: 'x' }, { email: '  ', password: 'x' }, { email: 1, password: 2 }])(
    '400 VALIDATION_ERROR con body inválido %j', async (body) => {
      const r = await handleLoginRequest(body);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ code: 'VALIDATION_ERROR', recoverable: true });
      expect(findFirst).not.toHaveBeenCalled();
    });

  it('401 AUTH_INVALID si el usuario no existe', async () => {
    findFirst.mockResolvedValue(null);
    const r = await handleLoginRequest({ email: 'x@y.z', password: 'Secreta123' });
    expect(r).toMatchObject({ status: 401, body: { code: 'AUTH_INVALID', recoverable: true } });
  });

  it('401 AUTH_INVALID si la contraseña no coincide', async () => {
    findFirst.mockResolvedValue(usuario());
    const r = await handleLoginRequest({ email: 'recepcion@arnold.gym', password: 'mala' });
    expect(r.status).toBe(401);
  });

  it.each(['INACTIVO', 'BLOQUEADO'])('403 AUTH_DISABLED con estado %s y contraseña correcta', async (estado) => {
    findFirst.mockResolvedValue(usuario({ estado }));
    const r = await handleLoginRequest({ email: 'recepcion@arnold.gym', password: 'Secreta123' });
    expect(r).toMatchObject({ status: 403, body: { code: 'AUTH_DISABLED', recoverable: false } });
  });

  it('no revela el estado de la cuenta si la contraseña es incorrecta', async () => {
    findFirst.mockResolvedValue(usuario({ estado: 'BLOQUEADO' }));
    const r = await handleLoginRequest({ email: 'recepcion@arnold.gym', password: 'mala' });
    expect(r.status).toBe(401);
  });

  it('200: token de 24h con sub, rol y jti; body sin password', async () => {
    findFirst.mockResolvedValue(usuario());
    const r = await handleLoginRequest({ email: 'recepcion@arnold.gym', password: 'Secreta123' });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.body).toEqual({ success: true, role: 'RECEPCIONISTA' });
    const p = verifyJWT(r.token)!;
    expect(p).toMatchObject({ sub: 'u1', rol: 'RECEPCIONISTA' });
    expect(p.jti).toBeDefined();
    expect(p.exp! - p.iat!).toBe(86400);
    expect(JSON.stringify(r)).not.toContain(hash);
  });

  it('normaliza el email (trim + case-insensitive) y excluye usuarios borrados', async () => {
    findFirst.mockResolvedValue(null);
    await handleLoginRequest({ email: '  Recepcion@Arnold.GYM ', password: 'x' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'recepcion@arnold.gym', mode: 'insensitive' }, deletedAt: null },
    });
  });

  describe('auditoría de accesos (P-15)', () => {
    const creds = { email: 'recepcion@arnold.gym', password: 'Secreta123' };

    it('login correcto → LOGIN/ALLOW con el usuario y el contexto de la request', async () => {
      findFirst.mockResolvedValue(usuario());
      await handleLoginRequest(creds, ctx);
      expect(audit).toHaveBeenCalledTimes(1);
      expect(audit).toHaveBeenCalledWith({ usuarioId: 'u1', accion: 'LOGIN', resultado: 'ALLOW', context: ctx });
    });

    it('contraseña incorrecta → LOGIN/DENY AUTH_INVALID atribuido al usuario apuntado', async () => {
      findFirst.mockResolvedValue(usuario());
      await handleLoginRequest({ ...creds, password: 'mala' }, ctx);
      expect(audit).toHaveBeenCalledWith({ usuarioId: 'u1', accion: 'LOGIN', resultado: 'DENY', motivo: 'AUTH_INVALID', context: ctx });
    });

    it('email desconocido → LOGIN/DENY AUTH_INVALID con usuarioId null', async () => {
      findFirst.mockResolvedValue(null);
      await handleLoginRequest(creds, ctx);
      expect(audit).toHaveBeenCalledWith({ usuarioId: null, accion: 'LOGIN', resultado: 'DENY', motivo: 'AUTH_INVALID', context: ctx });
    });

    it('cuenta deshabilitada con la contraseña correcta → LOGIN/DENY AUTH_DISABLED', async () => {
      findFirst.mockResolvedValue(usuario({ estado: 'BLOQUEADO' }));
      await handleLoginRequest(creds, ctx);
      expect(audit).toHaveBeenCalledWith({ usuarioId: 'u1', accion: 'LOGIN', resultado: 'DENY', motivo: 'AUTH_DISABLED', context: ctx });
    });

    it('body inválido (400) no se audita: no es un intento de acceso', async () => {
      await handleLoginRequest({}, ctx);
      expect(audit).not.toHaveBeenCalled();
    });

    it('la respuesta no cambia con la auditoría (mismo status y body)', async () => {
      findFirst.mockResolvedValue(usuario());
      const r = await handleLoginRequest({ ...creds, password: 'mala' }, ctx);
      expect(r).toMatchObject({ status: 401, body: { code: 'AUTH_INVALID' } });
    });
  });
});
