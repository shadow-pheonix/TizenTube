import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('saved defaults, late metadata, per-video overrides, and quality menus work together', async () => {
    const modules = ['/config.js', '/features/preferredVideoQuality.js', '/features/qualityController.js', '/utils/videoQuality.js', '/ui/qualityUI.js'];
    const english = JSON.parse(await readFile(new URL('../translations/resources/en.json', import.meta.url)));
    const server = createServer(async (request, response) => {
        if (request.url === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end(`<!doctype html><html><body><script type="importmap">{"imports":{"i18next":"/i18next.js"}}</script><script type="module" src="/init.js"></script></body></html>`);
            return;
        }
        response.setHeader('Content-Type', 'text/javascript');
        if (modules.includes(request.url)) {
            response.end(await readFile(new URL('..' + request.url, import.meta.url)));
        } else if (request.url === '/i18next.js') {
            response.end(`const text = ${JSON.stringify(english)}; export function t(key, data = {}) {
                let value = key.split('.').reduce((node, part) => node?.[part], text) || key;
                for (const [name, replacement] of Object.entries(data)) value = value.replace('{{' + name + '}}', replacement);
                return value;
            }`);
        } else if (request.url === '/ui/ytUI.js') {
            response.end(`export function buttonItem(title, icon, commands) { return { title, icon, commands }; }
                export function overlayPanelItemListRenderer(items) { return items; }
                export function overlayMessageRenderer(text) { return { text }; }
                export function showModal(header, items, id) { window.lastMenu = { header, items, id }; }`);
        } else if (request.url === '/init.js') {
            response.end(`import { configWrite, configRead } from '/config.js';
                import { qualitySettings, patchQualityMenu } from '/ui/qualityUI.js';
                window.testQuality = { configWrite, configRead, qualitySettings, patchQualityMenu };
                window.makePlayer = (id, choices = []) => {
                    const player = document.createElement('div');
                    player.className = 'html5-video-player'; player.videoId = id;
                    player.choices = choices; player.calls = []; player.current = 'hd720';
                    player.getVideoData = () => ({ video_id: player.videoId });
                    player.getAvailableQualityData = () => player.choices;
                    player.getPlaybackQuality = () => player.current;
                    player.isInline = () => false;
                    player.getPlayerResponse = () => ({ videoDetails: { videoId: player.videoId }, streamingData: { adaptiveFormats: [
                        { itag: 315, height: 2160, mimeType: 'video/webm', bitrate: 18000000 }
                    ] } });
                    player.setPlaybackQualityRange = (...args) => { player.calls.push(args); player.current = args[0]; };
                    player.setPlaybackQuality = value => player.calls.push(['adaptive', value]);
                    return player;
                };
                window.player = makePlayer('first'); document.body.appendChild(player);
                await import('/features/preferredVideoQuality.js');
                window.qualityReady = true;`);
        } else {
            response.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.qualityReady);
        await page.evaluate(() => testQuality.configWrite('preferredVideoQuality', '2160p'));
        assert.equal(await page.evaluate(() => player.calls.length), 0);
        await page.evaluate(() => {
            player.choices = [{ quality: 'hd720', qualityLabel: '720p' }];
            player.dispatchEvent(new Event('onStateChange'));
        });
        assert.deepEqual(await page.evaluate(() => player.calls.at(-1)), ['hd720', 'hd720']);
        await page.evaluate(() => {
            player.choices.push({ quality: 'hd2160', qualityLabel: '2160p60', formatId: '315', isPlayable: true },
                { quality: 'highres', qualityLabel: '4320p', formatId: '571', isPlayable: false });
        });
        await page.waitForFunction(() => player.calls.at(-1)?.[0] === 'hd2160');
        assert.deepEqual(await page.evaluate(() => player.calls.at(-1)), ['hd2160', 'hd2160', '315']);
        await page.evaluate(() => testQuality.qualitySettings());
        const menu = await page.evaluate(() => lastMenu);
        assert.equal(menu.header.title, 'Video quality');
        assert.equal(menu.items[1].title.title, 'Highest available');
        assert.ok(menu.items.some(item => item.title?.subtitle === 'Video bitrate: 18 Mbps'));
        assert.ok(!menu.items.some(item => item.title?.title === '4320p'));
        // Execute the actual per-video command produced by the quality menu.
        const command = menu.items.find(item => item.title?.title === '720p').commands[1].customAction;
        await page.evaluate(parameters => preferredVideoQualityHandler.setManualQuality(parameters), command.parameters);
        assert.deepEqual(await page.evaluate(() => player.calls.at(-1)), ['hd720', 'hd720']);
        assert.equal(await page.evaluate(() => testQuality.configRead('preferredVideoQuality')), '2160p');
        await page.evaluate(() => {
            player.videoId = 'second';
            player.choices = [{ quality: 'hd1080', qualityLabel: '1080p' }, { quality: 'hd720', qualityLabel: '720p' }];
            player.dispatchEvent(new Event('onStateChange'));
        });
        assert.deepEqual(await page.evaluate(() => player.calls.at(-1)), ['hd1080', 'hd1080']);
        await page.reload();
        await page.waitForFunction(() => window.qualityReady);
        assert.equal(await page.evaluate(() => testQuality.configRead('preferredVideoQuality')), '2160p');
        await page.evaluate(() => {
            player.choices = [{ quality: 'hd2160', qualityLabel: '2160p', formatId: '315' }];
            player.dispatchEvent(new Event('onStateChange'));
        });
        assert.deepEqual(await page.evaluate(() => player.calls.at(-1)), ['hd2160', 'hd2160', '315']);
        await page.evaluate(() => testQuality.configWrite('preferredVideoQuality', 'auto'));
        assert.deepEqual(await page.evaluate(() => player.calls.slice(-2)), [['tiny', 'highres'], ['adaptive', 'auto']]);
        const patched = await page.evaluate(() => {
            const items = [{ compactLinkRenderer: { icon: { iconType: 'HD' }, serviceEndpoint: { original: true } } }];
            testQuality.patchQualityMenu(items);
            testQuality.patchQualityMenu(items);
            return items;
        });
        assert.equal(patched.length, 1);
        assert.equal(patched[0].compactLinkRenderer.serviceEndpoint.customAction.action, 'TT_QUALITY_SETTINGS_SHOW');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
