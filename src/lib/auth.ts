import bcryptjs from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { type UserRole } from '@/lib/authorization';
import { randomUUID } from 'crypto';

const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-secret-key-change-in-production';
}

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
  jti?: string; // unique token ID
  iat?: number; // issued at
  exp?: number; // expires at
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
  return jwt.sign({ sub: userId, ...payload }, getJwtSecret(), {
    expiresIn,
    jwtid: randomUUID(),
  } as SignOptions);
}

/**
 * Verify and decode a JWT token
 * @param token The JWT token to verify
 * @returns The decoded JWT payload if valid, null if invalid or expired
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
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
export function extractUserFromAuthHeader(authHeader?: string): { id: string; rol?: UserRole } | null {
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
    rol: payload.rol as UserRole | undefined,
  };
}

export const AUTH_COOKIE_NAME = 'authToken';

export interface RequestLike {
  headers: { get(name: string): string | null };
  cookies?: { get(name: string): { value: string } | undefined };
}

/** Identidad de la petición: header Bearer o cookie de sesión. Nunca headers x-user-*. */
/** Header Authorization equivalente a las credenciales de la petición. La cookie va primero:
 *  es la identidad que validó el proxy (estado ACTIVO en DB). */
export function authHeaderFromRequest(request: RequestLike): string | undefined {
  const token = request.cookies?.get(AUTH_COOKIE_NAME)?.value;
  if (token) return `Bearer ${token}`;
  return request.headers.get('authorization') ?? undefined;
}

/** Identidad de la petición: cookie de sesión o header Bearer. Nunca headers x-user-*. */
export function extractUserFromRequest(
  request: RequestLike
): { id: string; rol?: UserRole } | null {
  return extractUserFromAuthHeader(authHeaderFromRequest(request));
}

/**
 * Request object with user attached (from JWT verification)
 * Used by API handlers to pass user context, body, and request metadata
 */
export interface RequestWithUser {
  user?: {
    id: string;
    email: string;
    nombre: string;
    rol: UserRole;  // Typed as UserRole enum (SOCIO | INSTRUCTOR | RECEPCIONISTA | ADMINISTRADOR)
  } | null;
  body?: unknown; // Request body (parsed JSON or form data)
  ip?: string; // Client IP address
  headers?: Record<string, string | string[]>; // Request headers
}
