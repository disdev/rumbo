// Mantiene sw.js#SW_VERSION igual a data/config.json#content_version (§8).
// El navegador solo reinstala el SW cuando sus bytes cambian, así que
// content_version y SW_VERSION deben moverse juntos en cada deploy —
// correr esto después de bumpear content_version, antes de deploy.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'data', 'config.json'), 'utf8'));
const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8');

const updated = sw.replace(/const SW_VERSION = '[^']*';/, `const SW_VERSION = '${config.content_version}';`);
if (updated === sw && !sw.includes(`const SW_VERSION = '${config.content_version}';`)) {
  console.error('⚠️ no se encontró la línea "const SW_VERSION = \'...\';" en sw.js');
  process.exit(1);
}
writeFileSync(swPath, updated);
console.log(`✅ sw.js SW_VERSION → ${config.content_version}`);
