import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { beforeAll, describe, expect, test } from 'vitest';
import { devTokenVerifier, firebaseTokenVerifier } from './firebaseToken.ts';

const PROJECT = 'demo-go-game';

let privateKey: CryptoKey;
let verify: ReturnType<typeof firebaseTokenVerifier>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
  verify = firebaseTokenVerifier(PROJECT, createLocalJWKSet({ keys: [jwk] }));
});

function token(claims: { iss?: string; aud?: string; sub?: string; expires?: string }): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(claims.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(claims.aud ?? PROJECT)
    .setSubject(claims.sub ?? 'uid-ann')
    .setIssuedAt()
    .setExpirationTime(claims.expires ?? '1h')
    .sign(privateKey);
}

describe('firebaseTokenVerifier', () => {
  test('gives the uid of a good token', async () => {
    expect(await verify(await token({}))).toBe('uid-ann');
  });

  test('refuses a token for another project', async () => {
    await expect(verify(await token({ aud: 'other', iss: 'https://securetoken.google.com/other' }))).rejects.toThrow();
  });

  test('refuses a token from another issuer', async () => {
    await expect(verify(await token({ iss: 'https://evil.example' }))).rejects.toThrow();
  });

  test('refuses an expired token', async () => {
    await expect(verify(await token({ expires: '-1m' }))).rejects.toThrow();
  });

  test('refuses a token that another key signed', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setAudience(PROJECT)
      .setSubject('uid-ann')
      .setExpirationTime('1h')
      .sign(other.privateKey);
    await expect(verify(forged)).rejects.toThrow();
  });

  test('refuses a token with no subject', async () => {
    const empty = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setAudience(PROJECT)
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(verify(empty)).rejects.toThrow();
  });
});

describe('devTokenVerifier', () => {
  test('reads the uid from a dev token, or from an unsigned token of the Firebase Auth emulator', async () => {
    expect(await devTokenVerifier('dev-ann')).toBe('ann');
    const emulator = `${btoa('{"alg":"none"}')}.${btoa('{"sub":"emu-1"}')}.`;
    expect(await devTokenVerifier(emulator)).toBe('emu-1');
  });

  test('refuses anything else', async () => {
    await expect(devTokenVerifier('dev-')).rejects.toThrow();
    await expect(devTokenVerifier('nonsense')).rejects.toThrow();
  });
});
