import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('startup and manual checks send verified fork downloads to Android without repeat prompts', async () => {
    const modules = ['/config.js', '/features/updater.js', '/utils/forkUpdates.js'];
    const server = createServer(async (request, response) => {
        if (request.url === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end('<!doctype html><html><body><script type="importmap">{"imports":{"i18next":"/i18next.js"}}</script><script type="module" src="/init.js"></script></body></html>');
            return;
        }
        response.setHeader('Content-Type', 'text/javascript');
        if (modules.includes(request.url)) response.end(await readFile(new URL('..' + request.url, import.meta.url)));
        else if (request.url === '/i18next.js') response.end('export const t = key => key;');
        else if (request.url === '/ui/ytUI.js') response.end('export const showToast = (...args) => window.toasts.push(args);');
        else if (request.url === '/init.js') response.end(`
            import { configWrite } from '/config.js';
            window.toasts = []; window.downloads = []; window.requests = [];
            window.installed = 'v2.0.3-amoled.4'; window.architecture = 'arm64-v8a';
            window.makeRelease = version => ({ tag_name: version, draft: false, prerelease: false,
                assets: ['arm', 'arm64'].map(arch => ({ name: 'TizenTube-AMOLED-' + arch + '.apk', size: 123,
                    digest: 'sha256:' + 'a'.repeat(64), browser_download_url: 'https://github.com/shadow-pheonix/TizenTubeCobalt/releases/download/' + version + '/TizenTube-AMOLED-' + arch + '.apk' })) });
            window.release = makeRelease('v2.0.3-amoled.5');
            window.h5vcc = { tizentube: { GetVersion: () => installed, GetArchitecture: () => architecture,
                InstallAppFromURL: url => { downloads.push(url); return true; } } };
            window.fetch = async url => { requests.push(url); return { ok: true, json: async () => release }; };
            window.timeouts = new Map(); window.intervals = []; let nextId = 0;
            window.setTimeout = (callback, delay) => { timeouts.set(++nextId, { callback, delay }); return nextId; };
            window.clearTimeout = id => timeouts.delete(id);
            window.setInterval = (callback, delay) => { intervals.push({ callback, delay }); return ++nextId; };
            const updater = await import('/features/updater.js');
            window.checkUpdate = updater.default; window.setUpdateConfig = configWrite;
            window.updaterReady = true;
        `);
        else response.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.updaterReady);
        await page.evaluate(() => [...timeouts.values()].find(timer => timer.delay === 2500).callback());
        await page.waitForFunction(() => downloads.length === 1);
        const first = await page.evaluate(() => ({ url: downloads[0], requests, interval: intervals[0].delay, toasts }));
        assert.equal(first.requests[0], 'https://api.github.com/repos/shadow-pheonix/TizenTubeCobalt/releases/latest');
        assert.ok(first.url.includes('/v2.0.3-amoled.5/TizenTube-AMOLED-arm64.apk#'));
        assert.ok(first.url.includes('sha256=' + 'a'.repeat(64)));
        assert.ok(first.url.endsWith('manual=0'));
        assert.equal(first.interval, 60 * 60 * 1000);
        await page.evaluate(async () => { installed = 'v2.0.3-amoled.5'; await checkUpdate(true); });
        assert.equal(await page.evaluate(() => downloads.length), 1);
        assert.equal(await page.evaluate(() => toasts.at(-1)[0]), 'settings.options.updater.upToDate.title');
        await page.evaluate(async () => {
            release = makeRelease('v2.0.3-amoled.6'); setUpdateConfig('enableUpdater', false);
            await checkUpdate(false);
        });
        assert.equal(await page.evaluate(() => downloads.length), 1);
        await page.evaluate(async () => { architecture = 'armeabi-v7a'; await checkUpdate(true); });
        assert.equal(await page.evaluate(() => downloads.length), 2);
        assert.ok((await page.evaluate(() => downloads.at(-1))).includes('/TizenTube-AMOLED-arm.apk#'));
        assert.ok((await page.evaluate(() => downloads.at(-1))).endsWith('manual=1'));
        await page.evaluate(async () => {
            release = makeRelease('v2.0.3-amoled.7'); release.assets[0].digest = null;
            await checkUpdate(true);
        });
        assert.equal(await page.evaluate(() => downloads.length), 2);
        assert.equal(await page.evaluate(() => toasts.at(-1)[0]), 'settings.options.updater.checkFailed.title');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
