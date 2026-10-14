import type { Config } from 'jest';

// Config de Jest para los tests de integración (P-25): sólo Node, contra un Postgres real.
// No carga tests/setup.ts (nada de jsdom ni Testing Library).
const config: Config = {
  displayName: 'arnold-integration-tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/tests/integration/setup-env.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  testTimeout: 30000,
};

export default config;
