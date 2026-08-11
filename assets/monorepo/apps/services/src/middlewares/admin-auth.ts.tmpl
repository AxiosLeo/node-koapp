import { error } from '@axiosleo/koapp';
import type { KoaContext } from '@axiosleo/koapp';

export interface AdminSessionUser {
  username: string;
}

/**
 * Session-based auth for /api admin routes.
 * Requires context.koa.session.user set by POST /api/login.
 */
export async function adminAuthMiddleware(context: KoaContext): Promise<void> {
  const session = context.koa.session as { user?: AdminSessionUser } | null | undefined;
  const user = session?.user;
  if (!user || !user.username) {
    error(401, 'Unauthorized');
  }

  context.auth = {
    app_id: null,
    key_id: '',
    is_admin: true
  };
}
