import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for jsdom environment
// Fixes userEvent encoding issues in parallel test execution
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Jest setup file — runs before all tests
// Add any global test utilities, mocks, or fixtures here

// Mock next/server globally to avoid ReferenceError during test suite compilation
jest.mock('next/server', () => {
  // NextResponse constructor: new NextResponse(body, options)
  const NextResponseConstructor = function (body: any, options?: any) {
    return {
      json: jest.fn(async () => body),
      status: options?.status || 200,
      headers: options?.headers || {},
    };
  };

  // Static method: NextResponse.json(data, options)
  NextResponseConstructor.json = (data: any, options?: any) => ({
    json: jest.fn(async () => data),
    status: options?.status || 200,
    headers: options?.headers || {},
  });

  return {
    NextRequest: jest.fn(),
    NextResponse: NextResponseConstructor,
  };
});

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
