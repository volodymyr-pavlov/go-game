// The VITE_FIREBASE_* values are not secrets. The rules in the firebase/ folder control who can read and write.

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';

export interface FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
}

export interface FirebaseConfig {
  options: FirebaseOptions;
  /** A reCAPTCHA v3 site key turns on Firebase App Check. Then only pages from this site may write. */
  recaptchaSiteKey: string | null;
  /** The address of the local emulators. Only for development. A production build never uses it. */
  emulatorHost: string | null;
}

export const AUTH_EMULATOR_PORT = 9099;

export type Unsubscribe = () => void;

export interface Account {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
}

/** The part of Firebase Auth the app uses. The SDK functions are wrapped, so a test can fake this with a few lines. */
export interface AuthApi {
  currentAccount(): Account | null;
  onAccountChange(listener: (account: Account | null) => void): Unsubscribe;
  signInAnonymously(): Promise<Account>;
  signInWithEmail(email: string, password: string): Promise<Account>;
  /** Adds an email and a password to the signed-in account. */
  linkEmail(email: string, password: string): Promise<void>;
  /** The ID token that proves to the game server who the signed-in player is, or null when nobody is signed in. */
  idToken(): Promise<string | null>;
  signOut(): Promise<void>;
  /** Deletes the signed-in account. */
  deleteAccount(): Promise<void>;
}

export function firebaseConfig(): FirebaseConfig | null {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_RECAPTCHA_SITE_KEY,
    VITE_FIREBASE_EMULATOR,
    DEV,
  } = import.meta.env;
  if (!VITE_FIREBASE_API_KEY || !VITE_FIREBASE_AUTH_DOMAIN || !VITE_FIREBASE_PROJECT_ID) return null;
  return {
    options: {
      apiKey: VITE_FIREBASE_API_KEY,
      authDomain: VITE_FIREBASE_AUTH_DOMAIN,
      projectId: VITE_FIREBASE_PROJECT_ID,
      ...(VITE_FIREBASE_APP_ID ? { appId: VITE_FIREBASE_APP_ID } : {}),
    },
    recaptchaSiteKey: VITE_FIREBASE_RECAPTCHA_SITE_KEY || null,
    emulatorHost: DEV && VITE_FIREBASE_EMULATOR ? VITE_FIREBASE_EMULATOR : null,
  };
}

let connection: Promise<AuthApi> | null = null;

/** Connects to Firebase Auth once. Firebase does nothing else in this app: the game server keeps the players and the rooms. */
export function connectAuth(config: FirebaseConfig): Promise<AuthApi> {
  connection ??= open(config);
  return connection;
}

async function open(config: FirebaseConfig): Promise<AuthApi> {
  const [{ initializeApp }, authSdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = initializeApp(config.options);
  if (config.recaptchaSiteKey !== null) await enableAppCheck(app, config.recaptchaSiteKey);
  const auth = authSdk.getAuth(app);
  if (import.meta.env.DEV && config.emulatorHost !== null) {
    authSdk.connectAuthEmulator(auth, `http://${config.emulatorHost}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true });
  }
  return authApi(auth, authSdk);
}

function authApi(auth: Auth, sdk: typeof import('firebase/auth')): AuthApi {
  const signedIn = () => {
    if (auth.currentUser === null) throw new Error('Sign in first');
    return auth.currentUser;
  };
  return {
    currentAccount: () => auth.currentUser,
    onAccountChange: (listener) => sdk.onAuthStateChanged(auth, listener),
    signInAnonymously: async () => (await sdk.signInAnonymously(auth)).user,
    signInWithEmail: async (email, password) => (await sdk.signInWithEmailAndPassword(auth, email, password)).user,
    linkEmail: async (email, password) => {
      await sdk.linkWithCredential(signedIn(), sdk.EmailAuthProvider.credential(email, password));
    },
    idToken: async () => (auth.currentUser === null ? null : auth.currentUser.getIdToken()),
    signOut: () => sdk.signOut(auth),
    deleteAccount: () => sdk.deleteUser(signedIn()),
  };
}

async function enableAppCheck(app: FirebaseApp, siteKey: string): Promise<void> {
  const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
}
