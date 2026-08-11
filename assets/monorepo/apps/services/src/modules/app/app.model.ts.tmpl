import type { EntityStatus } from '../../types';
import { paginationRules } from '../../types';
import type { ApiKeyRecord, AppRecord } from '../../services/sqlite';

export interface AppItem {
  id: string;
  name: string;
  description: string;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateAppBody {
  name: string;
  description?: string;
}

export interface UpdateAppBody {
  name?: string;
  description?: string;
  status?: EntityStatus;
}

export interface AppListQuery {
  page?: number;
  size?: number;
  keyword?: string;
}

export interface ApiKeyItem {
  id: string;
  app_id: string;
  name: string;
  prefix: string;
  status: EntityStatus;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateApiKeyBody {
  name?: string;
}

export interface CreateApiKeyResult extends ApiKeyItem {
  /** Plaintext token — only returned once at creation. */
  token: string;
}

export const createAppRules = {
  name: 'required|string|max:64',
  description: 'string'
};

export const updateAppRules = {
  name: 'string|max:64',
  description: 'string',
  status: 'in:active,disabled'
};

export const appIdRules = {
  id: 'required|string'
};

export const appListQueryRules = {
  ...paginationRules
};

export const createApiKeyRules = {
  name: 'string|max:64'
};

export const apiKeyIdRules = {
  id: 'required|string',
  keyId: 'required|string'
};

export function toAppItem(record: AppRecord): AppItem {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export function toApiKeyItem(record: ApiKeyRecord): ApiKeyItem {
  return {
    id: record.id,
    app_id: record.app_id,
    name: record.name,
    prefix: record.prefix,
    status: record.status,
    last_used_at: record.last_used_at,
    created_at: record.created_at
  };
}
