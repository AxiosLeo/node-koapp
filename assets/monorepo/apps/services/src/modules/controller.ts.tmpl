import type { KoaContext } from '@axiosleo/koapp';
import { Controller } from '@axiosleo/koapp';

export class BaseController extends Controller {
  constructor() {
    super();
  }

  /**
   * Resolve the app scope for the current request.
   * - Bearer Api-Key: always the key's app_id (required).
   * - Admin session: optional explicit app_id from query/body; null = no filter.
   */
  protected appId(context: KoaContext): string | null {
    if (context.auth?.is_admin) {
      const queryAppId = (context.query as Record<string, unknown> | undefined)?.app_id;
      const bodyAppId = (context.body as Record<string, unknown> | undefined)?.app_id;
      if (typeof queryAppId === 'string' && queryAppId) {
        return queryAppId;
      }
      if (typeof bodyAppId === 'string' && bodyAppId) {
        return bodyAppId;
      }
      return null;
    }

    const appId = context.auth?.app_id;
    if (!appId) {
      this.error(401, 'Unauthorized');
    }
    return appId!;
  }

  protected isAdmin(context: KoaContext): boolean {
    return context.auth?.is_admin === true;
  }

  protected isUniqueConstraintError(err: unknown): boolean {
    if (!err || typeof err !== 'object') {
      return false;
    }
    const code = (err as { code?: string }).code || '';
    if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return true;
    }
    const message = String((err as { message?: string }).message || '');
    return /UNIQUE constraint failed/i.test(message);
  }
}
