/**
 * Token management utility functions
 * 
 * Single Responsibility: JWT and token operations
 */

import { encodeBase64, decodeBase64 } from '../data/serialization-utils';

export interface TokenPayload {
  sub: string; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expiration
  aud?: string; // Audience
  iss?: string; // Issuer
  [key: string]: any; // Additional claims
}

/**
 * Parse JWT token (without verification)
 * WARNING: This does not verify the token signature - use only for extracting claims
 */
export function parseJWT(token: string): { header: any; payload: TokenPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [headerB64, payloadB64] = parts;
    
    // Add padding if needed
    const headerDecoded = decodeBase64(addBase64Padding(headerB64));
    const payloadDecoded = decodeBase64(addBase64Padding(payloadB64));
    
    const header = JSON.parse(headerDecoded);
    const payload = JSON.parse(payloadDecoded);
    
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Add base64 padding if needed
 */
function addBase64Padding(base64: string): string {
  const padding = 4 - (base64.length % 4);
  return padding === 4 ? base64 : base64 + '='.repeat(padding);
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const parsed = parseJWT(token);
  if (!parsed) return true;
  
  const now = Math.floor(Date.now() / 1000);
  const expiry = parsed.payload.exp;
  
  return !expiry || (expiry - bufferSeconds) <= now;
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const parsed = parseJWT(token);
  if (!parsed || !parsed.payload.exp) return null;
  
  return new Date(parsed.payload.exp * 1000);
}

/**
 * Get time until token expires
 */
export function getTokenTimeToExpiry(token: string): number {
  const expiration = getTokenExpiration(token);
  if (!expiration) return 0;
  
  const now = new Date();
  return Math.max(0, expiration.getTime() - now.getTime());
}

/**
 * Extract user ID from token
 */
export function extractUserIdFromToken(token: string): string | null {
  const parsed = parseJWT(token);
  return parsed?.payload.sub || null;
}

/**
 * Extract custom claims from token
 */
export function extractTokenClaims(token: string): Record<string, any> {
  const parsed = parseJWT(token);
  if (!parsed) return {};
  
  const { sub, iat, exp, aud, iss, ...customClaims } = parsed.payload;
  return customClaims;
}

/**
 * Validate token structure (basic validation)
 */
export function isValidTokenStructure(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  try {
    const parsed = parseJWT(token);
    return parsed !== null && 
           typeof parsed.payload.sub === 'string' &&
           typeof parsed.payload.iat === 'number' &&
           typeof parsed.payload.exp === 'number';
  } catch {
    return false;
  }
}

/**
 * Generate a simple token payload structure
 */
export function createTokenPayload(
  userId: string,
  expirationHours = 24,
  additionalClaims: Record<string, any> = {}
): TokenPayload {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + (expirationHours * 60 * 60);
  
  return {
    sub: userId,
    iat: now,
    exp: expiry,
    ...additionalClaims,
  };
}

/**
 * Extract bearer token from authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Create authorization header value
 */
export function createBearerToken(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Check if token needs refresh
 */
export function shouldRefreshToken(token: string, refreshThresholdHours = 1): boolean {
  const timeToExpiry = getTokenTimeToExpiry(token);
  const thresholdMs = refreshThresholdHours * 60 * 60 * 1000;
  
  return timeToExpiry > 0 && timeToExpiry <= thresholdMs;
}

/**
 * Validate token audience
 */
export function validateTokenAudience(token: string, expectedAudience: string): boolean {
  const parsed = parseJWT(token);
  return parsed?.payload.aud === expectedAudience;
}

/**
 * Validate token issuer
 */
export function validateTokenIssuer(token: string, expectedIssuer: string): boolean {
  const parsed = parseJWT(token);
  return parsed?.payload.iss === expectedIssuer;
}

/**
 * Get token age in seconds
 */
export function getTokenAge(token: string): number {
  const parsed = parseJWT(token);
  if (!parsed || !parsed.payload.iat) return 0;
  
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, now - parsed.payload.iat);
}

/**
 * Check if token was issued recently
 */
export function isTokenFresh(token: string, maxAgeHours = 24): boolean {
  const ageSeconds = getTokenAge(token);
  const maxAgeSeconds = maxAgeHours * 60 * 60;
  
  return ageSeconds <= maxAgeSeconds;
}

/**
 * Create token info object
 */
export function getTokenInfo(token: string): {
  isValid: boolean;
  isExpired: boolean;
  userId: string | null;
  expiresAt: Date | null;
  issuedAt: Date | null;
  timeToExpiry: number;
  customClaims: Record<string, any>;
} {
  const parsed = parseJWT(token);
  const isValid = isValidTokenStructure(token);
  const isExpired = isTokenExpired(token);
  
  return {
    isValid,
    isExpired,
    userId: extractUserIdFromToken(token),
    expiresAt: getTokenExpiration(token),
    issuedAt: parsed?.payload.iat ? new Date(parsed.payload.iat * 1000) : null,
    timeToExpiry: getTokenTimeToExpiry(token),
    customClaims: extractTokenClaims(token),
  };
}