const fs = require('fs');
const path = require('path');

function fixJsFile(content) {
  let result = '';
  let i = 0;
  let changed = false;

  while (i < content.length) {
    const ch = content[i];

    // Skip line comments
    if (ch === '/' && content[i + 1] === '/') {
      let j = i;
      while (j < content.length && content[j] !== '\n') j++;
      result += content.slice(i, j);
      i = j;
      continue;
    }

    // Skip block comments
    if (ch === '/' && content[i + 1] === '*') {
      let j = i + 2;
      while (j < content.length && !(content[j - 1] === '*' && content[j] === '/')) j++;
      j++;
      result += content.slice(i, j);
      i = j;
      continue;
    }

    // Skip template literals
    if (ch === '`') {
      let j = i + 1;
      while (j < content.length) {
        if (content[j] === '\\') { j += 2; continue; }
        if (content[j] === '`') { j++; break; }
        j++;
      }
      result += content.slice(i, j);
      i = j;
      continue;
    }

    // Skip double-quoted strings
    if (ch === '"') {
      let j = i + 1;
      while (j < content.length) {
        if (content[j] === '\\') { j += 2; continue; }
        if (content[j] === '"') { j++; break; }
        j++;
      }
      result += content.slice(i, j);
      i = j;
      continue;
    }

    // Single-quoted string — check if it contains a French apostrophe
    if (ch === "'") {
      let j = i + 1;
      let str = '';
      while (j < content.length) {
        if (content[j] === '\\') { str += content[j] + content[j + 1]; j += 2; continue; }
        if (content[j] === "'") { j++; break; }
        str += content[j];
        j++;
      }
      // French apostrophe pattern: lowercase letter followed by ' followed by letter
      if (/[a-zàâéèêëîïôùûü]'[a-zA-ZàâéèêëîïôùûüÀÂÉÈÊËÎÏÔÙÛÜ]/.test(str)) {
        // Use double quotes; escape any double quotes inside
        const escaped = str.replace(/"/g, '\\"');
        result += '"' + escaped + '"';
        changed = true;
      } else {
        result += "'" + str + "'";
      }
      i = j;
      continue;
    }

    result += ch;
    i++;
  }

  return { content: result, changed };
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') {
      walk(full);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      const src = fs.readFileSync(full, 'utf8');
      const { content, changed } = fixJsFile(src);
      if (changed) {
        fs.writeFileSync(full, content, 'utf8');
        console.log('FIXED:', path.relative('C:/Users/yassi/Desktop/dark-store-app/backend/src', full));
      }
    }
  }
}

walk('C:/Users/yassi/Desktop/dark-store-app/backend/src');
console.log('Done.');
