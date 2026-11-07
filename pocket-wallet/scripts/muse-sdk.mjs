#!/usr/bin/env node
// Credentials enter through the environment, never command-line arguments.
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SDK_TOKEN_PREFIX = 'mgs' + 't_';
const TOKEN_PATTERN = new RegExp('^' + SDK_TOKEN_PREFIX + '[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$');

export function sdkCredential(env = process.env) {
  const variable = ['SDK_TOKEN', 'GADGET_API_KEY', 'MUSEGADGET_SDK_TOKEN'].find(name => env[name]?.trim());
  if (!variable) throw new Error('SDK_TOKEN is missing. Add your Muse Gadget SDK token to the private environment file.');
  const token = env[variable].trim();
  if (!TOKEN_PATTERN.test(token)) throw new Error(`${variable} has an invalid Muse SDK token format. Copy it from gadgets.muse.ai > Account > SDK tokens.`);
  return {variable, token};
}

// Muse commands inherit the SDK's restricted child environment. Keep provider
// credentials out of the SDK process as well; its companion uses a scoped file.
export function sdkEnvironment(env = process.env) {
  const {token} = sdkCredential(env);
  const result = {};
  for (const [name, value] of Object.entries(env)) {
    if (/^(?:PATH|HOME|USER|LOGNAME|LANG|LC_[A-Z_]+|TMPDIR|SUDO_USER|DBUS_SYSTEM_BUS_ADDRESS|XDG_RUNTIME_DIR|VIRTUAL_ENV|MUSEGADGET_STATE_DIR|MUSEGADGET_SOCKET|MUSEGADGET_RUN_AS)$/.test(name)) result[name] = value;
  }
  result.SDK_TOKEN = token;
  result.MUSEGADGET_SDK_TOKEN = token;
  return result;
}

function privateBuildPath(file, root) {
  const target = resolve(root, file);
  const local = relative(root, target);
  if (!local || local.startsWith('..') || isAbsolute(local) || !/^build[^/]*(?:\/|$)/.test(local) || !local.endsWith('/sdkconfig')) {
    throw new Error('Use a per-build sdkconfig inside this workspace\'s ignored build directory.');
  }
  let ancestor = dirname(target);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const realLocal = relative(realpathSync(root), realpathSync(ancestor));
  if (realLocal.startsWith('..') || isAbsolute(realLocal)) throw new Error('Build paths must stay inside the workspace.');
  if (realLocal && !/^build[^/]*(?:\/|$)/.test(realLocal)) throw new Error('Resolved paths must stay in an ignored build directory.');
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('The private sdkconfig must not be a symbolic link.');
  return target;
}

export function writeFirmwareToken(file, env = process.env, root = workspace) {
  const {token} = sdkCredential(env);
  const target = privateBuildPath(file, root);
  const directory = dirname(target);
  mkdirSync(directory, {recursive: true, mode: 0o700});
  chmodSync(directory, 0o700);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const lines = current.split(/\r?\n/).filter(line => !/^\s*(?:CONFIG_GADGET_SDK_TOKEN\s*=|# CONFIG_GADGET_SDK_TOKEN is not set\s*$)/.test(line));
  while (lines.at(-1) === '') lines.pop();
  lines.push(`CONFIG_GADGET_SDK_TOKEN="${token}"`);
  const scratch = mkdtempSync(join(directory, '.sdk-token-'));
  try {
    const temporary = join(scratch, 'sdkconfig');
    writeFileSync(temporary, `${lines.join('\n')}\n`, {mode: 0o600, flag: 'wx'});
    renameSync(temporary, target);
  } finally {rmSync(scratch, {recursive: true, force: true});}
  return target;
}

const help = `Muse Gadget SDK helper (load .env.local with Node --env-file)
  check                              Validate SDK_TOKEN locally; no network or pairing
  pair [--sdk DIR] [--python PATH]    Pair a prepared Linux SDK in the Muse phone app
  run [--sdk DIR] [--python PATH] [--run-as USER]
                                     Connect an already paired Linux SDK
  info [--sdk DIR] [--python PATH]    Read the SDK's device identity and pairing state
  firmware-config --sdkconfig PATH    Set CONFIG_GADGET_SDK_TOKEN in a private build config
Defaults: --sdk build/muse-linux; --python python3
`;

export function main(argv = process.argv.slice(2)) {
  const [action, ...remaining] = argv;
  if (!action || action === '--help' || action === '-h') {console.log(help); return 0;}
  const options = {};
  for (let index = 0; index < remaining.length; index += 2) {
    const name = remaining[index];
    if (!['--sdk', '--python', '--run-as', '--sdkconfig'].includes(name) || !remaining[index + 1] || options[name]) throw new Error('Invalid arguments. Run the helper with --help.');
    options[name] = remaining[index + 1];
  }
  const allowed = action === 'check' ? [] : action === 'firmware-config' ? ['--sdkconfig'] : ['--sdk', '--python', ...(action === 'run' ? ['--run-as'] : [])];
  if (Object.keys(options).some(name => !allowed.includes(name))) throw new Error('These options do not apply to this command.');
  if (action === 'check') {
    const {variable} = sdkCredential();
    console.log(`Muse SDK token: configured (${variable}); format matches the supplied SDK.`);
    console.log('Muse connection: requires a paired device; token format validation does not authenticate a session.');
    console.log(`Host: ${process.platform}; Linux pairing requires BlueZ, system dbus/gi and the Muse phone app.`);
    return 0;
  }
  if (action === 'firmware-config') {
    if (!options['--sdkconfig']) throw new Error('Provide --sdkconfig build/<board>/sdkconfig.');
    process.umask(0o077);
    const target = writeFirmwareToken(options['--sdkconfig']);
    console.log(`Muse SDK token configured in ${relative(workspace, target)} (mode 0600).`);
    console.log('Build configuration prepared; board port, ESP-IDF build, flashing and Muse app pairing remain separate steps.');
    return 0;
  }
  if (!['pair', 'run', 'info'].includes(action)) throw new Error('Unknown command. Run the helper with --help.');
  if (process.platform !== 'linux') throw new Error('Muse Linux SDK requires a Linux host. Use this helper on your Pi or Linux computer with BlueZ; this host cannot perform that pairing.');
  const sdk = resolve(workspace, options['--sdk'] || 'build/muse-linux');
  if (!existsSync(join(sdk, 'src/musegadget/cli.py'))) throw new Error('Prepared Muse SDK is missing. Run scripts/prepare-linux-sdk.py with a fresh build directory.');
  const env = sdkEnvironment();
  env.PYTHONPATH = [join(sdk, 'src'), join(workspace, 'linux')].join(':');
  const args = ['-m', 'musegadget', action];
  if (options['--run-as']) args.push('--run-as', options['--run-as']);
  const child = spawnSync(options['--python'] || 'python3', args, {cwd: workspace, env, stdio: 'inherit'});
  if (child.error) throw new Error('Could not launch the SDK Python interpreter. Use --python with its installed virtual environment.');
  return child.status ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {process.exitCode = main();}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}
