const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Fix a single line: convert single-quoted string containing apostrophe to double-quoted
// e.g.: "message: 'l'article'" → "message: "l'article""
function fixLine(line, col) {
  // Find the start of the single-quoted string near col
  // Walk backwards from col-1 to find the opening quote
  let start = col - 1; // col is 1-based, make 0-based
  while (start >= 0 && line[start] !== "'") start--;
  if (start < 0) return line; // can't find

  // Walk forwards from start+1 to find the matching close quote
  // The "broken" string goes from start to the NEXT quote that ends the full string
  // We need to find the TRUE end: scan for a quote that's followed by , ; ) } \n or end
  let pos = start + 1;
  // The "broken" end is at col-1 where node detected the problem
  // The real string content spans from start+1 to some later quote
  // Strategy: from start, find all ' characters and pick the one that makes a valid string
  // containing the apostrophe
  const candidates = [];
  let p = start + 1;
  while (p < line.length) {
    if (line[p] === "'") candidates.push(p);
    p++;
  }

  // Try each candidate as the end quote - pick the one where the preceding char is a letter/digit/space
  // and the following char is a delimiter
  for (const end of candidates) {
    const inner = line.slice(start + 1, end);
    // Valid string: contains the French apostrophe AND makes sense as a message
    if (/[a-zàâéèêëîïôùûü]'[a-zA-ZàâéèêëîïôùûüÀÂÉÈÊËÎÏÔÙÛÜ]/.test(inner)) {
      // Replace from start to end (inclusive)
      const before = line.slice(0, start);
      const after = line.slice(end + 1);
      const escaped = inner.replace(/"/g, '\\"');
      return before + '"' + escaped + '"' + after;
    }
  }

  return line; // fallback
}

function tryParseAndFix(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      new vm.Script(src, { filename: filePath });
      break; // no error
    } catch (e) {
      if (!e.stack) break;
      // Parse error position from Node error
      const match = e.stack.match(/:(\d+)\n(.+)\n(\s+)\^/);
      if (!match) break;

      const lineNum = parseInt(match[1], 10);
      const lines = src.split('\n');
      if (lineNum < 1 || lineNum > lines.length) break;

      const originalLine = lines[lineNum - 1];
      // Find column from the caret
      const col = match[3].length + 1;

      const fixed = fixLine(originalLine, col);
      if (fixed === originalLine) break; // can't fix

      lines[lineNum - 1] = fixed;
      src = lines.join('\n');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log('FIXED:', path.relative('C:/Users/yassi/Desktop/dark-store-app/backend/src', filePath));
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') {
      walk(full);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      tryParseAndFix(full);
    }
  }
}

walk('C:/Users/yassi/Desktop/dark-store-app/backend/src');
console.log('Done.');
