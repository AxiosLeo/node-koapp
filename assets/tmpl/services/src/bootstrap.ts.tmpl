import cluster from 'cluster';
import { cpus } from 'os';
import { printer } from '@axiosleo/cli-tool';
import App from './app';

import config from './config';

const numCPUs = cpus().length;
const debugMode = config.envs.deploy !== 'prod';
const processCount = debugMode ? 1 : numCPUs;

if (cluster.isPrimary) {
  printer.println();
  printer.yellow(`Deploy Env: ${config.envs.deploy}`).println();
  printer.yellow(`Current CPU number: ${numCPUs}`).println();
  printer.yellow(`Process count: ${processCount}`).println().println();
  for (let i = 0; i < processCount; i++) {
    cluster.fork();
  }
  cluster.on('listening', (worker, address) => {
    printer.yellow('worker pid: ').print(`${worker.process.pid}`)
      .yellow(' listening on ').green(`${address.port}`).println(' port');
  });
  cluster.on('exit', (worker, code, signal) => {
    printer.warning(`Worker ${worker.process.pid} died with code: ${code} and signal: ${signal}`);
    printer.warning('Starting a new worker...');
    cluster.fork();
  });
} else {
  const app = new App();
  app.start();
}
