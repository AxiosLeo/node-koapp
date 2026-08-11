import { Router } from '@axiosleo/koapp';
import controller from './app.controller';
import {
  apiKeyIdRules,
  appIdRules,
  appListQueryRules,
  createApiKeyRules,
  createAppRules,
  updateAppRules
} from './app.model';

const router = new Router('/apps');

router.post('', (ctx) => controller.create(ctx), {
  body: { rules: createAppRules }
});

router.get('', (ctx) => controller.list(ctx), {
  query: { rules: appListQueryRules }
});

router.get('/{:id}', (ctx) => controller.detail(ctx), {
  params: { rules: appIdRules }
});

router.patch('/{:id}', (ctx) => controller.update(ctx), {
  params: { rules: appIdRules },
  body: { rules: updateAppRules }
});

router.delete('/{:id}', (ctx) => controller.remove(ctx), {
  params: { rules: appIdRules }
});

router.get('/{:id}/keys', (ctx) => controller.listKeys(ctx), {
  params: { rules: appIdRules }
});

router.post('/{:id}/keys', (ctx) => controller.createKey(ctx), {
  params: { rules: appIdRules },
  body: { rules: createApiKeyRules }
});

router.delete('/{:id}/keys/{:keyId}', (ctx) => controller.revokeKey(ctx), {
  params: { rules: apiKeyIdRules }
});

export default router;
