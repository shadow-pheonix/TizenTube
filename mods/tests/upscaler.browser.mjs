import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('native upscaler follows saved settings without sending controls to older APKs', async () => {
    const modules = ['/config.js', '/features/upscaler.js', '/utils/upscaler.js'];
    const server = createServer(async (request, response) => {
        const path = request.url.split('?')[0];
        if (path === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end('<!doctype html><html><body><script type="module" src="/init.js"></script></body></html>');
            return;
        }
        response.setHeader('Content-Type', 'text/javascript');
        if (modules.includes(path)) response.end(await readFile(new URL('..' + path, import.meta.url)));
        else if (path === '/init.js') response.end(`
            import { configWrite } from '/config.js';
            window.commands = []; window.configWrite = configWrite;
            window.h5vcc = { tizentube: {
                GetVersion: () => new URLSearchParams(location.search).get('version') || 'v2.0.3-amoled.5',
                InstallAppFromURL: command => commands.push(command)
            } };
            await import('/features/upscaler.js'); window.ready = true;
        `);
        else response.writeHead(404).end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        const address = `http://127.0.0.1:${server.address().port}`;
        await page.goto(address); await page.waitForFunction(() => ready);
        assert.deepEqual(await page.evaluate(() => commands), ['tizentube://upscaler/auto']);
        await page.evaluate(() => { configWrite('preferredVideoQuality', '2160p'); configWrite('videoUpscaler', 'quality'); });
        assert.deepEqual(await page.evaluate(() => commands), ['tizentube://upscaler/auto', 'tizentube://upscaler/quality']);
        await page.reload(); await page.waitForFunction(() => ready);
        assert.deepEqual(await page.evaluate(() => commands), ['tizentube://upscaler/quality']);
        await page.evaluate(() => configWrite('videoUpscaler', 'off'));
        assert.equal(await page.evaluate(() => commands.at(-1)), 'tizentube://upscaler/off');
        await page.goto(address + '?version=v2.0.3-amoled.4'); await page.waitForFunction(() => ready);
        await page.evaluate(() => configWrite('videoUpscaler', 'auto'));
        assert.deepEqual(await page.evaluate(() => commands), []);
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
