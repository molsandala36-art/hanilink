/// <reference types="vite/client" />

declare module '@vercel/node' {
  import type { Request, Response } from 'express';

  export interface VercelRequest extends Request {}

  export interface VercelResponse extends Response {}
}
