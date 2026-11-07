import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {sdkCredential, sdkEnvironment, writeFirmwareToken, SDK_TOKEN_PREFIX} from '../muse-sdk.mjs';

// Synthetic canonical base64url fixture; never a real SDK credential.
const synthetic = `${SDK_TOKEN_PREFIX}${'A'.repeat(43)}`;
const secondary = `${SDK_TOKEN_PREFIX}${'B'.repeat(42)}A`;

test('SDK_TOKEN wins over legacy names and rejects invalid tokens without disclosing them', () => {
  assert.equal(sdkCredential({SDK_TOKEN: synthetic, GADGET_API_KEY: secondary}).token, synthetic);
  assert.equal(sdkCredential({SDK_TOKEN: ' ', GADGET_API_KEY: secondary}).variable, 'GADGET_API_KEY');
  assert.equal(sdkCredential({MUSEGADGET_SDK_TOKEN: synthetic}).token, synthetic);
  assert.throws(() => sdkCredential({SDK_TOKEN: 'private-invalid-value'}), error => !error.message.includes('private-invalid-value'));
  assert.throws(() => sdkCredential({SDK_TOKEN: ''}), /missing/);
});

test('SDK subprocess receives its token and runtime settings without provider or agent secrets', () => {
  const env = sdkEnvironment({SDK_TOKEN: synthetic, PATH: '/usr/bin', HOME: '/home/pi',
    MUSEGADGET_STATE_DIR: '/private/state', BIRDEYE_API_KEY: 'private-provider',
    META_API_KEY: 'private-meta', RPC_URL: 'https://private-rpc',
    BROWSER_USE_API_KEY: 'private-browser', GADGET_API_KEY: secondary});
  assert.deepEqual(env, {SDK_TOKEN: synthetic, MUSEGADGET_SDK_TOKEN: synthetic,
    PATH: '/usr/bin', HOME: '/home/pi', MUSEGADGET_STATE_DIR: '/private/state'});
});

test('firmware token replacement preserves other config and makes private per-build files', () => {
  const root = mkdtempSync(join(tmpdir(), 'pocket-sdk-test-'));
  try {
    const directory = join(root, 'build-esp32', 'build-board');
    mkdirSync(directory, {recursive: true});
    const file = join(directory, 'sdkconfig');
    writeFileSync(file, '# Board settings\nCONFIG_IDF_TARGET="esp32s3"\nCONFIG_GADGET_SDK_TOKEN="old"\nCONFIG_GADGET_SDK_TOKEN="duplicate"\n');
    writeFirmwareToken(file, {SDK_TOKEN: synthetic}, root);
    const content = readFileSync(file, 'utf8');
    assert.match(content, /CONFIG_IDF_TARGET="esp32s3"/);
    assert.equal(content.match(/CONFIG_GADGET_SDK_TOKEN=/g).length, 1);
    assert.ok(content.includes(synthetic));
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.throws(() => writeFirmwareToken('firmware/sdkconfig', {SDK_TOKEN: synthetic}, root), /ignored build/);
    mkdirSync(join(root, 'firmware'));
    symlinkSync(join(root, 'firmware'), join(root, 'build-source-link'));
    assert.throws(() => writeFirmwareToken('build-source-link/sdkconfig', {SDK_TOKEN: synthetic}, root), /ignored build/);
    const outside = mkdtempSync(join(tmpdir(), 'pocket-sdk-outside-'));
    try {
      symlinkSync(outside, join(root, 'build-escape'));
      assert.throws(() => writeFirmwareToken('build-escape/sdkconfig', {SDK_TOKEN: synthetic}, root), /inside the workspace/);
    } finally {rmSync(outside, {recursive: true, force: true});}
  } finally {rmSync(root, {recursive: true, force: true});}
});

test('CLI validation never echoes synthetic token or unrelated environment secrets', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/muse-sdk.mjs'), 'check'], {
    env: {...process.env, SDK_TOKEN: synthetic, META_API_KEY: 'private-meta'}, encoding: 'utf8'});
  assert.equal(result.status, 0);
  assert.match(result.stdout, /format matches the supplied SDK/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(synthetic));
  assert.ok(!`${result.stdout}${result.stderr}`.includes('private-meta'));
});

test('SDK preparation omits local credentials and device state while preserving the reference', () => {
  const root = mkdtempSync(join(tmpdir(), 'pocket-sdk-preparation-'));
  try {
    const source = join(root, 'source');
    const module = join(source, 'src', 'musegadget');
    mkdirSync(module, {recursive: true});
    const nativeConfig = 'import os\nSDK_TOKEN_ENV = "MUSEGADGET_SDK_TOKEN"\ndef sdk_token():\n    token = os.environ.get(SDK_TOKEN_ENV)\n    return token\n';
    writeFileSync(join(module, 'config.py'), nativeConfig);
    writeFileSync(join(module, 'executor.py'), 'COMMAND_SPECS = {}\nclass Executor:\n    def run(self, command: str, params: dict, timeout_ms: int | None = None) -> dict:\n        return {}\n');
    for (const name of ['.env.local', 'sdk_token', 'pairing.json', 'identity.json']) writeFileSync(join(source, name), 'private-fixture');
    const output = join(root, 'prepared');
    const result = spawnSync('python3', [resolve('scripts/prepare-linux-sdk.py'), '--source', source, '--output', output], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    for (const name of ['.env.local', 'sdk_token', 'pairing.json', 'identity.json']) assert.throws(() => statSync(join(output, name)), /ENOENT/);
    assert.equal(readFileSync(join(module, 'config.py'), 'utf8'), nativeConfig);
    assert.match(readFileSync(join(output, 'src', 'musegadget', 'config.py'), 'utf8'), /"SDK_TOKEN", "GADGET_API_KEY", SDK_TOKEN_ENV/);
    assert.match(readFileSync(join(output, 'src', 'musegadget', 'executor.py'), 'utf8'), /clawd\.portfolio/);
  } finally {rmSync(root, {recursive: true, force: true});}
});
