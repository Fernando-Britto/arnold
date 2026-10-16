import type { Config } from 'jest';

const config: Config = {
  displayName: 'arnold-unit-tests',
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integration/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // FX-18 (bis): `tests/setup.ts` sube `asyncUtilTimeout` a 5 s, pero eso sólo cubre `waitFor`/`findBy*`.
  // El timeout POR TEST de Jest seguía en el default de 5 s, y los suites que manejan la UI con muchos
  // `userEvent` secuenciales (kiosco de acceso/puerta) lo superan bajo carga paralela: 20 fallos
  // "Exceeded timeout of 5000 ms" con los workers por defecto (`cores-1`). 20 s les da aire de sobra y
  // no encarece el caso normal (sólo afecta a un test que ya está fallando).
  testTimeout: 20000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
};

export default config;
