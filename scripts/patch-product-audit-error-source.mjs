import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('./product-audit.mjs', import.meta.url);
let text = await readFile(path, 'utf8');
const from = `    } else {\n      errors.push(\`console: \${value}\`);\n    }`;
const to = `    } else {\n      const loc = message.location();\n      const source = loc?.url ? \` @ \${loc.url}\${Number.isFinite(loc.lineNumber) ? \`:\${loc.lineNumber}\` : ''}\` : '';\n      errors.push(\`console: \${value}\${source}\`);\n    }`;
if (!text.includes(to)) {
  if (!text.includes(from)) throw new Error('patch_anchor_missing:console_error');
  text = text.replace(from, to);
  await writeFile(path, text, 'utf8');
  console.log('patched product-audit console error source');
} else {
  console.log('product auditor already patched');
}
