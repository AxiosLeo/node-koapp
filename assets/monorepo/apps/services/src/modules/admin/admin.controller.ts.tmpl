import crypto from 'crypto';
import type { KoaContext } from '@axiosleo/koapp';
import { BaseController } from '../controller';
import type { AdminProfile, LoginBody } from './admin.model';
import type { AdminSessionUser } from '../../middlewares/admin-auth';
import config from '../../config';

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export class AdminController extends BaseController {
  async login(context: KoaContext) {
    const body = context.body as LoginBody;
    const expectedUser = config.envs.admin.username;
    const expectedPass = config.envs.admin.password;

    if (!expectedPass) {
      this.error(401, 'Unauthorized');
    }

    const userOk = safeEqualString(body.username, expectedUser);
    const passOk = safeEqualString(body.password, expectedPass);
    if (!userOk || !passOk) {
      this.error(401, 'Unauthorized');
    }

    const session = context.koa.session;
    if (!session) {
      this.error(500, 'Session unavailable');
    }

    const user: AdminSessionUser = { username: body.username };
    (session as { user?: AdminSessionUser }).user = user;

    const profile: AdminProfile = { username: body.username };
    this.success(profile);
  }

  async logout(context: KoaContext) {
    context.koa.session = null;
    this.success({ status: 'ok' });
  }

  async profile(context: KoaContext) {
    const session = context.koa.session as { user?: AdminSessionUser } | null | undefined;
    const user = session?.user;
    if (!user || !user.username) {
      this.error(401, 'Unauthorized');
    }
    const profile: AdminProfile = { username: user!.username };
    this.success(profile);
  }
}

export default new AdminController();
