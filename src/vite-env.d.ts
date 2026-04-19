/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_TENANT_CONFIGS?: string;
  readonly VITE_DEFAULT_TENANT?: string;
  readonly VITE_ENABLE_LICENSE_ENFORCEMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@vercel/node' {
  import type { Request, Response } from 'express';

  export interface VercelRequest extends Request {}

  export interface VercelResponse extends Response {}
}
