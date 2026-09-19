import '@testing-library/jest-dom';

// Jest setup file — runs before all tests
// Add any global test utilities, mocks, or fixtures here

// Mock next/server globally to avoid ReferenceError during test suite compilation
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (data: any, options?: any) => ({
      json: jest.fn(async () => data),
      status: options?.status || 200,
    }),
  },
}));

beforeAll(() => {
  // Setup test environment
  // process.env.NODE_ENV is readonly, so we use Object.defineProperty
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllMocks();
});
