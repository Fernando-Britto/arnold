// Se ejecuta antes de importar cualquier módulo de test (setupFiles), así que @/lib/db
// construye su PrismaClient contra la base de prueba y no contra la del .env del dev.
// Nunca lee el .env del proyecto a propósito: este harness no debe tocar la base de desarrollo.
// NODE_ENV es de sólo lectura para TS; se define igual que en tests/setup.ts.
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  configurable: true,
});
process.env.DATABASE_URL =
  process.env.ARNOLD_TEST_DATABASE_URL ?? 'postgresql://arnold:arnold@127.0.0.1:5433/arnold_test';
