import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose';

const FIREBASE_KEYS = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
);

/** Gives the uid of the player who holds `token`, or throws when the token is not a valid one. */
export type TokenVerifier = (token: string) => Promise<string>;

/** Checks a Firebase Auth ID token: Google signed it, it is for this project, and it has not expired. */
export function firebaseTokenVerifier(
  projectId: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(FIREBASE_KEYS),
): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('The token has no subject');
    return payload.sub;
  };
}

/**
 * For `wrangler dev` only. The token "dev-ann" is the player "ann", and so is a token of the Firebase Auth emulator, which
 * is not signed. Nothing checks either one, so a deployed Worker must never use this.
 */
export const devTokenVerifier: TokenVerifier = async (token) => {
  if (token.startsWith('dev-') && token.length > 'dev-'.length) return token.slice('dev-'.length);
  const { sub } = decodeJwt(token);
  if (typeof sub !== 'string' || sub === '') throw new Error('Not a dev token');
  return sub;
};
