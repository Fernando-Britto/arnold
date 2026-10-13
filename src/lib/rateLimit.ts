import { prisma } from '@/lib/db';

/**
 * Read-only check: has `key` exceeded `limit` hits for `route` in the last 60 seconds?
 * Does NOT record anything — safe to call on every request.
 *
 * @param key The key to rate limit (userId or IP address)
 * @param route The route/basePath being accessed (for grouping)
 * @param limit Maximum hits allowed in the 60-second window (default: 100)
 * @returns true if the request is limited, false if it is allowed
 */
export async function isRateLimited(
  key: string,
  route: string,
  limit: number = 100
): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const count = await prisma.rateLimitLog.count({
    where: {
      key,
      route,
      timestamp: {
        gte: oneMinuteAgo,
      },
    },
  });

  return count >= limit;
}

/**
 * Records one rate-limit hit for `key`+`route`. Callers decide WHAT counts as a hit
 * (e.g. the check-in kiosk records only failed identity attempts).
 */
export async function recordRateLimitHit(key: string, route: string): Promise<void> {
  await prisma.rateLimitLog.create({
    data: {
      key,
      route,
      timestamp: new Date(),
    },
  });
}

/**
 * Sliding window rate limiter.
 * Checks if a key (user ID or IP) has exceeded the request limit in the last 60 seconds.
 * If allowed, records the request and returns true; if exceeded, returns false without writing.
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
  if (await isRateLimited(key, route, limit)) {
    return false;
  }

  await recordRateLimitHit(key, route);
  return true;
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
