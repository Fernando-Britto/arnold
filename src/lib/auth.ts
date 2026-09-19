import bcryptjs from 'bcryptjs';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password using bcryptjs
 * @param password The plain-text password to hash
 * @returns The hashed password (salted, bcryptjs standard)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(SALT_ROUNDS);
  return bcryptjs.hash(password, salt);
}

/**
 * Compare a plain-text password against a bcryptjs hash
 * @param password The plain-text password to check
 * @param hash The bcryptjs hash to compare against
 * @returns true if password matches the hash, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * Create a JWT token for a user
 * @param userId The user's ID (string)
 * @param expiresIn Token expiration time (default: '7d', e.g., '24h', '7d', 3600)
 * @returns The signed JWT token
 */
export function createJWT(userId: string, expiresIn: string | number = '7d'): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn } as SignOptions);
}

/**
 * Verify and decode a JWT token
 * @param token The JWT token to verify
 * @returns The user ID (from token.sub) if valid, null if invalid or expired
 */
export function verifyJWT(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    return decoded.sub;
  } catch {
    // Invalid, expired, or tampered token
    return null;
  }
}
