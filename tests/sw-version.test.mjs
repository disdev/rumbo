// sw.js sólo se reinstala en clientes cuando sus bytes cambian (§8) — si
// SW_VERSION se queda atrás de content_version, deploys nuevos nunca llegan
// a browsers que ya tienen el SW instalado. node scripts/sync-sw-version.mjs
// los mantiene juntos; este test falla si alguien bumpea uno sin el otro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('sw.js SW_VERSION coincide con data/config.json content_version', () => {
  const config = JSON.parse(readFileSync(new URL('../data/config.json', import.meta.url)));
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const match = sw.match(/const SW_VERSION = '([^']*)';/);
  assert.ok(match, 'sw.js debe declarar const SW_VERSION = \'...\';');
  assert.equal(match[1], config.content_version,
    'corre `node scripts/sync-sw-version.mjs` después de bumpear content_version');
});

test('sw.js precachea todo lo de las misiones (Vuelo en ruta offline)', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const core = sw.slice(sw.indexOf('const CORE = ['), sw.indexOf('];', sw.indexOf('const CORE = [')));
  for (const f of ['src/js/misiones.js', 'src/js/misiones-logic.js', 'src/js/carta.js', 'src/js/figura-overlay.js', 'data/misiones.json', 'data/misiones/carta-costa-central.json']) {
    assert.ok(core.includes(`'${f}'`), `falta ${f} en CORE`);
  }
});
