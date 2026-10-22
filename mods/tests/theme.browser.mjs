import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('AMOLED changes surfaces immediately, preserves controls and custom colors, and persists', async () => {
    const fixture = `<!doctype html><html><head>
      <style nonce="theme-test">
        #container { background: #0f0f0f; color: white; }
        .ytLrOverlayPanelRenderer { background: linear-gradient(#444, #222); }
        button { color: white; background: #444; }
        button:focus { outline: 4px solid white; }
        ytlr-player, video { background: transparent; }
      </style></head><body><main id="container">
      <ytlr-guide-response><yt-focus-container>Navigation</yt-focus-container></ytlr-guide-response>
      <ytlr-browse>Home</ytlr-browse><ytlr-search>Search</ytlr-search>
      <div class="ytLrOverlayPanelRenderer">Settings <button>Focused control</button></div>
      <ytlr-player><video></video></ytlr-player></main>
      <script type="module" src="/init.js"></script></body></html>`;
    const server = createServer(async (request, response) => {
        response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'nonce-theme-test'");
        if (request.url === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end(fixture);
        } else if (request.url === '/init.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`import { configWrite, configRead } from '/config.js';
              import '/ui/theme.js'; window.themeConfig = { configWrite, configRead };`);
        } else if (['/config.js', '/ui/theme.js'].includes(request.url)) {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(await readFile(new URL('..' + request.url, import.meta.url)));
        } else {
            response.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
            args: ['--no-sandbox'],
        });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.themeConfig);
        const originalStyle = await page.locator('style[nonce]').first().textContent();
        const background = selector => page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor);
        assert.equal(await background('#container'), 'rgb(15, 15, 15)');
        await page.evaluate(() => {
            themeConfig.configWrite('routeColor', '#123456');
            themeConfig.configWrite('focusContainerColor', '#234567');
        });
        assert.equal(await background('#container'), 'rgb(18, 52, 86)');
        assert.equal(await background('yt-focus-container'), 'rgb(35, 69, 103)');
        await page.evaluate(() => themeConfig.configWrite('enableAmoledTheme', true));
        for (const selector of ['html', 'body', '#container', 'yt-focus-container', 'ytlr-browse', 'ytlr-search', '.ytLrOverlayPanelRenderer']) {
            assert.equal(await background(selector), 'rgb(0, 0, 0)', selector);
        }
        await page.locator('button').focus();
        assert.equal(await page.locator('button').evaluate(el => getComputedStyle(el).outlineColor), 'rgb(255, 255, 255)');
        assert.equal(await page.locator('button').evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
        assert.equal(await background('ytlr-player'), 'rgba(0, 0, 0, 0)');
        assert.equal(await background('video'), 'rgba(0, 0, 0, 0)');
        await page.evaluate(() => {
            const panel = document.createElement('div');
            panel.className = 'ytLrOverlayPanelRenderer';
            panel.id = 'new-panel';
            document.body.appendChild(panel);
        });
        assert.equal(await background('#new-panel'), 'rgb(0, 0, 0)');
        assert.equal(await page.locator('#new-panel').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
        await page.reload();
        await page.waitForFunction(() => window.themeConfig);
        assert.equal(await background('#container'), 'rgb(0, 0, 0)');
        assert.equal(await page.evaluate(() => themeConfig.configRead('enableAmoledTheme')), true);
        await page.evaluate(() => {
            for (let i = 0; i < 10; i++) themeConfig.configWrite('enableAmoledTheme', i % 2 === 0);
        });
        assert.equal(await background('#container'), 'rgb(18, 52, 86)');
        assert.equal(await background('yt-focus-container'), 'rgb(35, 69, 103)');
        assert.equal(await page.locator('style[nonce]').first().textContent(), originalStyle);
        assert.equal(await page.locator('#tizentube-theme').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-tizentube-amoled')), false);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
