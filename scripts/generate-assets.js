const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const libDir = path.join(baseDir, 'lib');
fs.mkdirSync(libDir, { recursive: true });

const assets = {};

// 1. Read index.html
const indexHtml = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
assets['/'] = { content: indexHtml, type: 'text/html; charset=utf-8' };
assets['/index.html'] = { content: indexHtml, type: 'text/html; charset=utf-8' };

// 2. Read logo.png as base64
if (fs.existsSync(path.join(baseDir, 'logo.png'))) {
  const logoBuf = fs.readFileSync(path.join(baseDir, 'logo.png'));
  assets['/logo.png'] = { content: logoBuf.toString('base64'), type: 'image/png', isBase64: true };
}

// 3. Read all js files recursively
function readDirRecursive(dir, prefix = '/js') {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      readDirRecursive(full, `${prefix}/${item}`);
    } else if (item.endsWith('.js')) {
      const code = fs.readFileSync(full, 'utf8');
      assets[`${prefix}/${item}`] = { content: code, type: 'text/javascript; charset=utf-8' };
    }
  }
}

readDirRecursive(path.join(baseDir, 'js'));

const outContent = `// Auto-generated embedded assets for zero-error serverless deployment
module.exports = ${JSON.stringify(assets, null, 2)};
`;

fs.writeFileSync(path.join(libDir, 'embedded-assets.js'), outContent, 'utf8');
console.log('Successfully generated lib/embedded-assets.js with', Object.keys(assets).length, 'assets.');
