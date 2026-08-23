/**
 * The single seam between screens and data.
 *
 * Production (and `VITE_USE_API=true`) uses the HTTP adapter against the Node
 * API. Local `npm run dev` keeps the mock adapter on seed JSON.
 */

import { httpAdapter } from './httpAdapter';
import { mockAdapter } from './mockAdapter';

/** Production and `VITE_USE_API=true` talk to the Node API. Local Vite keeps seed JSON. */
export const usesHttpApi = import.meta.env.PROD || import.meta.env.VITE_USE_API === 'true';

export const api = usesHttpApi ? httpAdapter : mockAdapter;
export type Api = typeof mockAdapter;
