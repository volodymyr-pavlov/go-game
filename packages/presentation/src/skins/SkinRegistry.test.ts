import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { OPPONENTS } from '@go-game/core/opponents.ts';
import { DEFAULT_SKIN, SKINS, parseSkinId, skinById } from './SkinRegistry.ts';
import type { SkinTextures } from './SkinTypes.ts';

interface Manifest {
  bundles: { name: string; assets: { alias: string; src: string }[] }[];
}

const PUBLIC = join(import.meta.dirname, '../../../../apps/web/public');
const manifest: Manifest = JSON.parse(readFileSync(join(PUBLIC, 'skins/manifest.json'), 'utf8'));

test('skin ids are unique and the default is the classic board', () => {
  assert.equal(new Set(SKINS.map((skin) => skin.id)).size, SKINS.length);
  assert.equal(DEFAULT_SKIN.id, 'classic');
  assert.equal(DEFAULT_SKIN.textures, undefined);
  assert.equal(DEFAULT_SKIN.sound, undefined);
});

test('every skin with textures has a manifest bundle whose aliases match and whose files exist', () => {
  for (const skin of SKINS) {
    if (skin.textures === undefined) continue;
    const bundle = manifest.bundles.find((candidate) => candidate.name === skin.id);
    assert.ok(bundle, `no bundle "${skin.id}" in public/skins/manifest.json`);
    const aliases = bundle.assets.map((asset) => asset.alias).sort();
    assert.deepEqual(aliases, Object.keys(skin.textures).sort());
    for (const asset of bundle.assets) {
      assert.equal(asset.src, skin.textures[asset.alias as keyof SkinTextures]);
      assert.ok(existsSync(join(PUBLIC, asset.src)), `${asset.src} is missing from public/`);
    }
  }
});

test('parseSkinId accepts known ids and rejects anything else', () => {
  assert.equal(parseSkinId('classic'), 'classic');
  assert.equal(parseSkinId('CLASSIC'), null);
  assert.equal(parseSkinId('wood'), null);
  assert.equal(parseSkinId(''), null);
  assert.equal(parseSkinId(null), null);
  assert.equal(skinById('classic').name, 'Classic Wood');
});

test('every sound and page background named by a skin exists in public/', () => {
  for (const skin of SKINS) {
    if (skin.sound !== undefined) assert.ok(existsSync(join(PUBLIC, skin.sound)), `${skin.sound} is missing`);
    if (skin.background !== undefined) {
      assert.ok(existsSync(join(PUBLIC, skin.background.url)), `${skin.background.url} is missing`);
    }
  }
});

test('a skin with avatars has one file per opponent, present in public/', () => {
  for (const skin of SKINS) {
    if (skin.avatars === undefined) continue;
    assert.deepEqual(Object.keys(skin.avatars).sort(), OPPONENTS.map((o) => o.name).sort());
    for (const url of Object.values(skin.avatars)) assert.ok(existsSync(join(PUBLIC, url)), `${url} is missing`);
  }
});
