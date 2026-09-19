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
 * Payload structure for JWT tokens
 */
export interface JWTPayload {
  sub: string; // user ID
  rol?: string; // user role (ADMINISTRADOR, INSTRUCTOR, RECEPCIONISTA, SOCIO)
  email?: string;
  nombre?: string;
}

/**
 * Create a JWT token for a user
 * @param userId The user's ID (string)
 * @param expiresIn Token expiration time (default: '7d', e.g., '24h', '7d', 3600)
 * @param payload Optional additional payload (rol, email, nombre)
 * @returns The signed JWT token
 */
export function createJWT(
  userId: string,
  expiresIn: string | number = '7d',
  payload?: Partial<JWTPayload>
): string {
  return jwt.sign({ sub: userId, ...payload }, JWT_SECRET, { expiresIn } as SignOptions);
}

/**
 * Verify and decode a JWT token
 * @param token The JWT token to verify
 * @returns The decoded JWT payload if valid, null if invalid or expired
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    // Invalid, expired, or tampered token
    return null;
  }
}

/**
 * Extract user from Authorization header
 * Supports Bearer token format: "Authorization: Bearer <token>"
 * @param authHeader The Authorization header value
 * @returns User object { id, rol } if valid token, null otherwise
 */
export function extractUserFromAuthHeader(authHeader?: string): { id: string; rol?: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const payload = verifyJWT(token);

  if (!payload) {
    return null;
  }

  return {
    id: payload.sub,
    rol: payload.rol,
  };
}

/**
 * Request object with user attached (from JWT verification)
 */
export interface RequestWithUser {
  user?: {
    id: string;
    email: string;
    nombre: string;
    rol: string;
  } | null;
}
