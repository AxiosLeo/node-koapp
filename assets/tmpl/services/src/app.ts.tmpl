import { KoaApplication } from '@axiosleo/koapp';
import { locales } from '@axiosleo/cli-tool';
import routers from '@/modules/index';
import path from 'path';
import config from './config';

export default class App extends KoaApplication {
  constructor() {
    const debugMode = config.envs.deploy !== 'prod';
    const staticRoot = config.envs.app.web_public;
    let root = path.join(__dirname, '../../');
    if (!debugMode) {
      root = process.cwd();
    }
    const options = {
      listen_host: '0.0.0.0',
      debug: debugMode,
      port: config.envs.app.api_port,
      routers,
      static: {
        rootDir: path.join(root, staticRoot || '../web/'),
        index: 'index.html',
        // notFoundFile: 'view/error/404.html'
      },
    };
    super(options);
    locales.init({
      format: 'js',
      sets: ['zh-CN', 'en-US'],
      use: 'zh-CN',
      dir: path.join(__dirname, '../locales')
    });
  }
}
