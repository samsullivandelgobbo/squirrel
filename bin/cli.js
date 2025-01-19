#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const devPath = path.join(__dirname, '..', 'src', 'cli.ts');
const prodPath = path.join(__dirname, '..', 'dist', 'cli.js');

if (fs.existsSync(devPath)) {
  require('ts-node').register();
  require(devPath);
} else {
  require(prodPath);
}