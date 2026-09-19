// Jest setup file — runs before all tests
// Add any global test utilities, mocks, or fixtures here

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
