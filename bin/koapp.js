#!/usr/bin/env node

'use strict';

const path = require('path');

const { App } = require('@axiosleo/cli-tool');
const app = new App({
  name: 'koapp',
  version: '1.0.0',
  desc: '',
  commands_dir: path.join(__dirname, '../commands'),
  commands_sort: ['help']
});

app.start();
