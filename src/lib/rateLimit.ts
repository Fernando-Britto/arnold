import { prisma } from '@/lib/db';

/**
 * Sliding window rate limiter.
 * Checks if a key (user ID or IP) has exceeded the request limit in the last 60 seconds.
 *
 * @param key The key to rate limit (userId or IP address)
 * @param route The route/basePath being accessed (for grouping)
 * @param limit Maximum requests allowed in the 60-second window (default: 100)
 * @returns true if the request is allowed, false if rate limit exceeded
 */
export async function checkRateLimit(
  key: string,
  route: string,
  limit: number = 100
): Promise<boolean> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // Count requests in the last 60 seconds for this key+route combination
  const count = await prisma.rateLimitLog.count({
    where: {
      key,
      route,
      timestamp: {
        gte: oneMinuteAgo,
      },
    },
  });

  // If under the limit, log this request and allow it
  if (count < limit) {
    await prisma.rateLimitLog.create({
      data: {
        key,
        route,
        timestamp: now,
      },
    });
    return true;
  }

  // Rate limit exceeded
  return false;
}

/**
 * Cleanup old rate limit logs (1-in-50 chance each call).
 * Removes logs older than 2 minutes to prevent table bloat.
 * Called from middleware with low probability to avoid performance impact.
 *
 * Probability: ~2% chance per request (1/50)
 */
export async function cleanupRateLimitLogsIfNeeded(): Promise<void> {
  // 1-in-50 chance (2%)
  if (Math.random() > 1 / 50) {
    return;
  }

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  try {
    await prisma.rateLimitLog.deleteMany({
      where: {
        timestamp: {
          lt: twoMinutesAgo,
        },
      },
    });
  } catch (error) {
    // Cleanup failure should not break the request, just log it
    console.error('Rate limit log cleanup failed:', error);
  }
}
