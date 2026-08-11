import { error } from '@axiosleo/koapp';
import type { KoaContext } from '@axiosleo/koapp';
import { resolveApiKey } from '../services/sqlite';

export interface AuthContext {
  /** Owning app id for Bearer keys; null for admin session (no app filter). */
  app_id: string | null;
  key_id: string;
  is_admin?: boolean;
}

declare module '@axiosleo/koapp' {
  interface KoaContext {
    auth?: AuthContext;
  }
}

/**
 * Bearer Token middleware.
 * Expects `Authorization: Bearer <api-key>`, resolves app_id via SQLite.
 * Health route bypasses this middleware (mounted on a sibling public router).
 */
export async function authMiddleware(context: KoaContext): Promise<void> {
  const header = context.headers?.authorization || context.headers?.Authorization;
  if (!header || typeof header !== 'string') {
    error(401, 'Unauthorized');
  }

  const match = /^Bearer\s+(.+)$/i.exec(header as string);
  if (!match) {
    error(401, 'Unauthorized');
  }

  const token = match![1].trim();
  if (!token) {
    error(401, 'Unauthorized');
  }

  const resolved = await resolveApiKey(token);
  if (!resolved) {
    error(401, 'Unauthorized');
  }

  context.auth = {
    app_id: resolved!.app_id,
    key_id: resolved!.key_id
  };
}
