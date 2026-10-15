/**
 * P-20 — Refresh token con rotación (handler level).
 * Cubre: emisión en el login (hash bcrypt en DB, nunca el token en claro) y el flujo de
 * refresh (rotación, detección de reuso, expirado, ausente y usuario deshabilitado).
 */
import { handleLoginRequest, handleRefreshRequest } from './auth';
import { hashPassword, comparePassword, verifyJWT } from '@/lib/auth';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    usuario: { findFirst: jest.fn(), findUnique: jest.fn() },
    refreshToken: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock('@/lib/audit', () => ({ recordAccessAttempt: jest.fn() }));

const transaction = prisma.$transaction as unknown as jest.Mock;
const findFirst = prisma.usuario.findFirst as unknown as jest.Mock;
const findUnique = prisma.usuario.findUnique as unknown as jest.Mock;
const rtCreate = prisma.refreshToken.create as unknown as jest.Mock;
const rtFindMany = prisma.refreshToken.findMany as unknown as jest.Mock;
const rtUpdate = prisma.refreshToken.update as unknown as jest.Mock;
const rtUpdateMany = prisma.refreshToken.updateMany as unknown as jest.Mock;

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await hashPassword('Secreta123');
});

beforeEach(() => {
  jest.clearAllMocks();
  // W: la rotación corre en una transacción; el mock entrega el mismo cliente como `tx`.
  transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
  rtCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'rt-new', ...data }));
  rtUpdate.mockResolvedValue({});
  rtUpdateMany.mockResolvedValue({ count: 0 });
  rtFindMany.mockResolvedValue([]);
});

const usuario = (over = {}) => ({
  id: 'u1',
  nombre: 'Ana',
  email: 'recepcion@arnold.gym',
  password: passwordHash,
  rol: 'RECEPCIONISTA',
  estado: 'ACTIVO',
  deletedAt: null,
  ...over,
});

const creds = { email: 'recepcion@arnold.gym', password: 'Secreta123' };

const activeRow = async (rawToken: string, over: Record<string, unknown> = {}) => ({
  id: 'rt-old',
  usuarioId: 'u1',
  tokenHash: await hashPassword(rawToken),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  revokedAt: null,
  replacedByTokenId: null,
  createdAt: new Date(),
  ...over,
});

describe('P-20 · login emite refresh token', () => {
  it('guarda el bcrypt del token (no el token en claro) y con vencimiento a 30 días', async () => {
    findFirst.mockResolvedValue(usuario());

    const r = await handleLoginRequest(creds);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;

    expect(r.refreshToken).toEqual(expect.any(String));
    expect(rtCreate).toHaveBeenCalledTimes(1);
    const data = rtCreate.mock.calls[0][0].data as { usuarioId: string; tokenHash: string; expiresAt: Date };
    expect(data.usuarioId).toBe('u1');
    // Nunca se guarda el token en claro
    expect(data.tokenHash).not.toBe(r.refreshToken);
    expect(await comparePassword(r.refreshToken!, data.tokenHash)).toBe(true);
    // 30 días
    const ttlSeconds = Math.round((data.expiresAt.getTime() - Date.now()) / 1000);
    expect(ttlSeconds).toBeGreaterThan(60 * 60 * 24 * 29);
    expect(ttlSeconds).toBeLessThanOrEqual(60 * 60 * 24 * 30);
  });

  it('NO cambia el TTL del access token (sigue siendo 24h)', async () => {
    findFirst.mockResolvedValue(usuario());
    const r = await handleLoginRequest(creds);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    const p = verifyJWT(r.token)!;
    expect(p.exp! - p.iat!).toBe(86400);
  });
});

describe('P-20 · handleRefreshRequest', () => {
  it('rotación válida: revoca el viejo (replacedByTokenId) y emite nuevo access + refresh', async () => {
    const raw = 'raw-refresh-valid';
    rtFindMany.mockResolvedValue([await activeRow(raw)]);
    findUnique.mockResolvedValue(usuario());

    const r = await handleRefreshRequest(raw);
    expect(r.status).toBe(204);
    if (r.status !== 204) return;

    // Nuevo access token para el usuario
    const p = verifyJWT(r.accessToken)!;
    expect(p.sub).toBe('u1');
    expect(p.exp! - p.iat!).toBe(86400);

    // Nuevo refresh token, distinto del presentado, guardado hasheado
    expect(r.refreshToken).toEqual(expect.any(String));
    expect(r.refreshToken).not.toBe(raw);
    const created = rtCreate.mock.calls[0][0].data as { tokenHash: string };
    expect(await comparePassword(r.refreshToken, created.tokenHash)).toBe(true);

    // El viejo queda revocado apuntando al nuevo
    expect(rtUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'rt-new' },
    });
  });

  it('reuso de un token revocado → 401 y revoca toda la cadena del usuario', async () => {
    const raw = 'raw-refresh-reused';
    rtFindMany.mockResolvedValue([await activeRow(raw, { revokedAt: new Date() })]);

    const r = await handleRefreshRequest(raw);
    expect(r.status).toBe(401);
    expect(rtUpdateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(rtCreate).not.toHaveBeenCalled();
    expect(rtUpdate).not.toHaveBeenCalled();
  });

  it('token expirado → 401 (no se encuentra entre los vigentes)', async () => {
    rtFindMany.mockResolvedValue([]);
    const r = await handleRefreshRequest('raw-refresh-expired');
    expect(r.status).toBe(401);
  });

  it('token ausente → 401 sin consultar la base', async () => {
    const r = await handleRefreshRequest(undefined);
    expect(r.status).toBe(401);
    expect(rtFindMany).not.toHaveBeenCalled();
  });

  it('usuario deshabilitado → 401 y no rota', async () => {
    const raw = 'raw-refresh-disabled';
    rtFindMany.mockResolvedValue([await activeRow(raw)]);
    findUnique.mockResolvedValue(usuario({ estado: 'BLOQUEADO' }));

    const r = await handleRefreshRequest(raw);
    expect(r.status).toBe(401);
    expect(rtCreate).not.toHaveBeenCalled();
    expect(rtUpdate).not.toHaveBeenCalled();
  });

  it('usuario borrado → 401', async () => {
    const raw = 'raw-refresh-deleted';
    rtFindMany.mockResolvedValue([await activeRow(raw)]);
    findUnique.mockResolvedValue(usuario({ deletedAt: new Date() }));

    const r = await handleRefreshRequest(raw);
    expect(r.status).toBe(401);
    expect(rtCreate).not.toHaveBeenCalled();
  });
});

describe('P-20 · la rotación es atómica (W)', () => {
  it('corre dentro de UNA transacción Serializable', async () => {
    const raw = 'raw-serializable';
    rtFindMany.mockResolvedValue([await activeRow(raw)]);
    findUnique.mockResolvedValue(usuario());

    const r = await handleRefreshRequest(raw);

    expect(r.status).toBe(204);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('P2034 (conflicto de serialización) → 401, sin emitir ni rotar', async () => {
    transaction.mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }));

    const r = await handleRefreshRequest('raw-p2034');

    expect(r.status).toBe(401);
    expect(rtCreate).not.toHaveBeenCalled();
    expect(rtUpdate).not.toHaveBeenCalled();
  });

  it('dos rotaciones concurrentes con el mismo token: una gana (204) y la otra no emite (401)', async () => {
    // NOTA HONESTA: el doble es un modelo en memoria con "commits" serializados; NO ejerce la
    // concurrencia real de Postgres. Lo que prueba es que, con transacciones serializadas, la
    // segunda rotación ve el token ya revocado y no emite un refresh nuevo. La garantí­a real de
    // aislamiento la aporta SERIALIZABLE (aseverado estructuralmente en el test de arriba).
    const raw = 'raw-race';
    const inicial = await activeRow(raw);
    const fila = { ...inicial };

    let serial: Promise<unknown> = Promise.resolve();
    let creados = 0;
    const tx = {
      usuario: { findUnique: jest.fn().mockResolvedValue(usuario()) },
      refreshToken: {
        findMany: jest.fn(async () => [{ ...fila }]),
        create: jest.fn(async ({ data }: { data: { tokenHash: string } }) => {
          creados += 1;
          return { id: `rt-new-${creados}`, ...data };
        }),
        update: jest.fn(
          async ({ where, data }: { where: { id: string }; data: { revokedAt: Date; replacedByTokenId: string } }) => {
            if (where.id === fila.id) Object.assign(fila, data);
            return {};
          }
        ),
        updateMany: jest.fn(async ({ data }: { data: { revokedAt: Date } }) => {
          Object.assign(fila, data);
          return { count: 1 };
        }),
      },
    };
    transaction.mockImplementation((cb: (tx: unknown) => unknown) => {
      const run = serial.then(() => cb(tx));
      serial = run.catch(() => {});
      return run;
    });

    const [a, b] = await Promise.all([handleRefreshRequest(raw), handleRefreshRequest(raw)]);

    expect([a.status, b.status].sort()).toEqual([204, 401]);
    expect(creados).toBe(1); // el que pierde la carrera no emite un refresh nuevo
  });
});
