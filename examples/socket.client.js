'use strict';

const { debug } = require('@axiosleo/cli-tool');
const { _sleep } = require('@axiosleo/cli-tool/src/helper/cmd');
const { SocketClient } = require('..');

let client = null;

/**
 * @returns {SocketClient}
 */
function getClient() {
  if (!client) {
    client = new SocketClient();
  }
  return client;
}

async function main() {
  try {
    const client = getClient();
    await client.send('get', '/api/test/123', {
      test: 123
    }, {
      data: {
        t: 1
      }
    });
  } catch (err) {
    debug.log('error', err.code);
  }

  // await _sleep(3000);
  // process.nextTick(main);
}

main().then(() => {
  // debug.log('done');
}).catch((err) => {
  // debug.log(err);
});
