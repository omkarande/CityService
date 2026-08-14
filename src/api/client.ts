/**
 * The single seam between screens and data.
 *
 * Today this points at the mock adapter reading local JSON. Phase 2 adds an
 * `httpAdapter` implementing the same surface and changes the line below —
 * nothing in `src/screens` or `src/components` should need touching.
 */

import { mockAdapter } from './mockAdapter';

export const api = mockAdapter;
export type Api = typeof api;
