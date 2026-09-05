// Works around an npm hoisting quirk with --legacy-peer-deps: ajv-keywords@5
// (used by react-scripts' terser-webpack-plugin chain) needs ajv@8, but the
// hoisted root ajv is v6 (needed by older ajv-keywords@3.x consumers like
// fork-ts-checker-webpack-plugin). Give ajv-keywords its own nested ajv@8.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'schema-utils', 'node_modules', 'ajv');
const dest = path.join(__dirname, '..', 'node_modules', 'ajv-keywords', 'node_modules', 'ajv');

if (fs.existsSync(src) && !fs.existsSync(dest)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('fix-ajv-keywords: nested ajv@8 into ajv-keywords/node_modules');
}
