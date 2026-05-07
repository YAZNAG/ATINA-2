const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'backend', 'src');

function check(file) {
  try {
    execSync('node --check "' + file + '"', { stdio: 'pipe' });
    return null;
  } catch (e) {
    return e.stderr ? e.stderr.toString() : String(e);
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') walk(full);
    else if (e.isFile() && e.name.endsWith('.js')) {
      const err = check(full);
      if (err) {
        const rel = path.relative(BASE, full);
        console.log('ERR:', rel);
        console.log(err.split('\n').slice(0, 5).join('\n'));
        console.log('---');
      }
    }
  }
}

walk(BASE);
console.log('scan done');
