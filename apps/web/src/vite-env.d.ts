/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_FIREBASE_EMULATOR?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_GA4_ID?: string;
}
