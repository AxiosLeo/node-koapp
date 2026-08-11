import type { KoaContext } from '@axiosleo/koapp';
import { BaseController } from '../controller';
import type {
  AppListQuery,
  CreateApiKeyBody,
  CreateAppBody,
  UpdateAppBody
} from './app.model';
import { toApiKeyItem, toAppItem } from './app.model';
import {
  createApiKey,
  createApp,
  getApiKey,
  getApp,
  listApiKeys,
  listApps,
  removeApp,
  revokeApiKey,
  updateApp
} from '../../services/sqlite';

export class AppController extends BaseController {
  async create(context: KoaContext) {
    const body = context.body as CreateAppBody;
    try {
      const record = createApp(body.name, body.description || '');
      this.success(toAppItem(record));
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        this.failed({ name: body.name }, '409;Data Already Exists', 409);
      }
      throw err;
    }
  }

  async list(context: KoaContext) {
    const query = (context.query || {}) as AppListQuery;
    const page = Number(query.page) || 1;
    const size = Number(query.size) || 20;
    const result = listApps({
      page,
      size,
      keyword: query.keyword
    });
    this.success({
      list: result.list.map(toAppItem),
      total: result.total,
      page: result.page,
      size: result.size
    });
  }

  async detail(context: KoaContext) {
    const id = context.params?.id || '';
    const record = getApp(id);
    if (!record) {
      this.error(404, 'Not Found App');
    }
    this.success(toAppItem(record!));
  }

  async update(context: KoaContext) {
    const id = context.params?.id || '';
    const body = (context.body || {}) as UpdateAppBody;
    try {
      const record = updateApp(id, body);
      if (!record) {
        this.error(404, 'Not Found App');
      }
      this.success(toAppItem(record!));
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        this.failed({ name: body.name }, '409;Data Already Exists', 409);
      }
      throw err;
    }
  }

  async remove(context: KoaContext) {
    const id = context.params?.id || '';
    const ok = removeApp(id);
    if (!ok) {
      this.error(404, 'Not Found App');
    }
    this.success({ id, deleted: true });
  }

  async listKeys(context: KoaContext) {
    const id = context.params?.id || '';
    const app = getApp(id);
    if (!app) {
      this.error(404, 'Not Found App');
    }
    const keys = listApiKeys(id).map(toApiKeyItem);
    this.success({ list: keys });
  }

  async createKey(context: KoaContext) {
    const id = context.params?.id || '';
    const body = (context.body || {}) as CreateApiKeyBody;
    const app = getApp(id);
    if (!app) {
      this.error(404, 'Not Found App');
    }
    const { record, token } = createApiKey(id, body.name || 'default');
    this.success({
      ...toApiKeyItem(record),
      token
    });
  }

  async revokeKey(context: KoaContext) {
    const id = context.params?.id || '';
    const keyId = context.params?.keyId || '';
    const app = getApp(id);
    if (!app) {
      this.error(404, 'Not Found App');
    }
    const key = getApiKey(id, keyId);
    if (!key) {
      this.error(404, 'Not Found ApiKey');
    }
    revokeApiKey(keyId);
    this.success({ id: keyId, revoked: true });
  }
}

export default new AppController();
