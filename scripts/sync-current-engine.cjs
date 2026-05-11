#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const desktopRoot = path.resolve(__dirname, '..');
const engineDir = path.join(desktopRoot, 'engine');
const sourceRoot = path.resolve(
    process.env.CLAUDE_CODE_SOURCE_ROOT || 'D:\\work\\py\\claude\\claude-code',
);
const skipBuild =
    process.argv.includes('--skip-build') || process.env.SKIP_ENGINE_BUILD === '1';

function fail(message) {
    console.error('[sync-engine] ' + message);
    process.exit(1);
}

function assertExists(target, label) {
    if (!fs.existsSync(target)) fail(`${label} not found: ${target}`);
}

function assertInside(parent, target, label) {
    const parentPath = path.resolve(parent);
    const targetPath = path.resolve(target);
    const rel = path.relative(parentPath, targetPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        fail(`${label} must stay inside ${parentPath}: ${targetPath}`);
    }
}

function removeGeneratedDir(target) {
    if (!fs.existsSync(target)) return;
    assertInside(engineDir, target, 'generated directory');
    fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(source, target) {
    assertExists(source, 'source directory');
    removeGeneratedDir(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
}

function firstExisting(paths) {
    return paths.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function findBunExe() {
    if (process.env.BUN_EXE_PATH && fs.existsSync(process.env.BUN_EXE_PATH)) {
        return process.env.BUN_EXE_PATH;
    }

    const home = os.homedir();
    const local = process.platform === 'win32'
        ? path.join(home, '.bun', 'bin', 'bun.exe')
        : path.join(home, '.bun', 'bin', 'bun');
    const direct = firstExisting([local]);
    if (direct) return direct;

    try {
        const command = process.platform === 'win32' ? 'where.exe' : 'which';
        const out = execFileSync(command, ['bun'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return out
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line && fs.existsSync(line)) || null;
    } catch (_) {
        return null;
    }
}

function runBuild(bunExe) {
    console.log('[sync-engine] building source engine:', sourceRoot);
    const result = spawnSync(bunExe, ['run', 'build'], {
        cwd: sourceRoot,
        stdio: 'inherit',
        env: process.env,
    });
    if (result.error) fail(`failed to start bun build: ${result.error.message}`);
    if (result.status !== 0) fail(`bun run build exited with ${result.status}`);
}

function writeEnginePackage(sourcePackage) {
    const pkg = {
        name: 'claude-desktop-engine',
        version: sourcePackage.version || '0.0.0-local',
        private: true,
        type: 'module',
        bin: {
            claude: './dist/cli-bun.js',
        },
        scripts: {
            start: 'bun ./dist/cli-bun.js',
            version: 'bun ./dist/cli-bun.js --version',
        },
    };
    fs.writeFileSync(
        path.join(engineDir, 'package.json'),
        JSON.stringify(pkg, null, 2) + '\n',
    );
}

function copyBunBinary(bunExe) {
    const binDir = path.join(engineDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const target = path.join(binDir, process.platform === 'win32' ? 'bun.exe' : 'bun');
    assertInside(engineDir, target, 'bun binary target');
    fs.copyFileSync(bunExe, target);
    try {
        fs.chmodSync(target, 0o755);
    } catch (_) {}
    return target;
}

assertExists(sourceRoot, 'CLAUDE_CODE_SOURCE_ROOT');
assertExists(path.join(sourceRoot, 'package.json'), 'source package.json');
fs.mkdirSync(engineDir, { recursive: true });

const bunExe = findBunExe();
if (!bunExe) fail('Bun executable not found. Install Bun or set BUN_EXE_PATH.');

if (!skipBuild) runBuild(bunExe);

const sourceDist = path.join(sourceRoot, 'dist');
const sourceCli = path.join(sourceDist, 'cli-bun.js');
assertExists(sourceCli, 'source dist/cli-bun.js');

console.log('[sync-engine] copying dist -> engine/dist');
copyDir(sourceDist, path.join(engineDir, 'dist'));

const sourcePackage = JSON.parse(
    fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'),
);
writeEnginePackage(sourcePackage);

const bundledBun = copyBunBinary(bunExe);
const metadata = {
    sourceRoot,
    sourceVersion: sourcePackage.version || null,
    syncedAt: new Date().toISOString(),
    cli: 'dist/cli-bun.js',
    bun: path.relative(engineDir, bundledBun).replace(/\\/g, '/'),
};
fs.writeFileSync(
    path.join(engineDir, 'ENGINE_SOURCE.json'),
    JSON.stringify(metadata, null, 2) + '\n',
);

console.log('[sync-engine] engine synced');
console.log('[sync-engine] source:', sourceRoot);
console.log('[sync-engine] cli:', path.join(engineDir, 'dist', 'cli-bun.js'));
console.log('[sync-engine] bun:', bundledBun);
