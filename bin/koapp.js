#!/usr/bin/env node

'use strict';

const path = require('path');
const { App } = require('@axiosleo/cli-tool');

const app = new App({
  name: 'koapp CLI',
  desc: 'koapp application generator',
  bin: 'koapp',
  version: '1.0.21',
  commands_dir: path.join(__dirname, '../commands'),
});

app.locale({
  sets: ['en-US', 'zh-CN',],
  dir: path.join(__dirname, '../assets/locales'),
  format: 'js',
});

app.start();
