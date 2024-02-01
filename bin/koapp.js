#!/usr/bin/env node

'use strict';

const path = require('path');
const { App } = require('@axiosleo/cli-tool');

const app = new App({
  name: 'koapp CLI',
  desc: 'koapp application generator',
  bin: 'koapp',
  version: '1.0.0-alpha.2',
  commands_dir: path.join(__dirname, '../commands'),
});

app.start();
