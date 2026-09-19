// Jest setup file — runs before all tests
// Add any global test utilities, mocks, or fixtures here

beforeAll(() => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllMocks();
});
