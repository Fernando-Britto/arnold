/**
 * Sanity test — verifies Jest is configured and running correctly
 * This test has no production dependency; it verifies the test harness only
 */

describe('Jest Setup Verification', () => {
  it('should execute a passing test', () => {
    expect(true).toBe(true);
  });

  it('should support async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
