import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, prepareUpdate, selectUpdate, FORK_REPOSITORY } from '../utils/forkUpdates.js';

function release(version = 'v2.0.3-amoled.4') {
    return { tag_name: version, draft: false, prerelease: false, assets: ['arm', 'arm64'].map(arch => ({
        name: `TizenTube-AMOLED-${arch}.apk`, size: 123, digest: 'sha256:' + 'a'.repeat(64),
        browser_download_url: `https://github.com/${FORK_REPOSITORY}/releases/download/${version}/TizenTube-AMOLED-${arch}.apk`,
    })) };
}

test('fork revisions compare numerically and do not reoffer the installed release', () => {
    assert.equal(compareVersions('v2.0.3-amoled.10', '2.0.3-amoled.9'), 1);
    assert.equal(compareVersions('v2.0.3-amoled.4', '2.0.3-amoled.4'), 0);
    assert.equal(compareVersions('v2.0.3-amoled.4', '2.0.3'), 1);
    assert.equal(compareVersions('v2.0.2-amoled.99', '2.0.3-amoled.1'), -1);
    assert.equal(selectUpdate(release(), 'v2.0.3-amoled.4', 'arm64-v8a'), null);
    assert.equal(selectUpdate(release(), 'v2.0.4-amoled.1', 'arm64-v8a'), null);
});

test('APK selection matches the actual installed APK architecture and exact filename', () => {
    const data = release(); data.assets.unshift({ name: 'TizenTube-AMOLED-arm64.json' });
    assert.equal(selectUpdate(data, 'v2.0.3-amoled.3', 'arm64-v8a').asset.name, 'TizenTube-AMOLED-arm64.apk');
    assert.equal(selectUpdate(data, 'v2.0.3-amoled.3', 'armeabi-v7a').asset.name, 'TizenTube-AMOLED-arm.apk');
    assert.throws(() => selectUpdate(data, 'v2.0.3-amoled.3', 'x86'));
});

test('only stable fork release assets with valid sizes and URLs can be installed', () => {
    for (const mutate of [data => data.draft = true, data => data.prerelease = true,
        data => data.tag_name = 'v2.0.4', data => data.assets[1].size = -1,
        data => data.assets[1].browser_download_url = 'https://other.invalid/file.apk',
        data => data.assets = []]) {
        const data = release(); mutate(data);
        assert.throws(() => selectUpdate(data, 'v2.0.3-amoled.3', 'arm64-v8a'));
    }
});

test('download commands contain the checksum, exact release version, size, and manual flag', async () => {
    const command = await prepareUpdate(release(), 'v2.0.3-amoled.3', 'arm64-v8a', () => assert.fail('Digest already supplied'), true);
    assert.ok(command.endsWith('#version=v2.0.3-amoled.4&sha256=' + 'a'.repeat(64) + '&size=123&manual=1'));
});

test('SHA256SUMS fallback uses only the matching APK from this same fork release', async () => {
    const data = release(); data.assets[1].digest = null;
    data.assets.push({ name: 'SHA256SUMS', browser_download_url: `https://github.com/${FORK_REPOSITORY}/releases/download/${data.tag_name}/SHA256SUMS` });
    const command = await prepareUpdate(data, 'v2.0.3-amoled.3', 'arm64-v8a', async url => {
        assert.equal(url, data.assets[2].browser_download_url);
        return { ok: true, text: async () => 'b'.repeat(64) + '  TizenTube-AMOLED-arm.apk\n' + 'c'.repeat(64) + '  TizenTube-AMOLED-arm64.apk\n' };
    });
    assert.ok(command.includes('sha256=' + 'c'.repeat(64)));
    data.assets[2].browser_download_url = 'https://other.invalid/SHA256SUMS';
    await assert.rejects(() => prepareUpdate(data, 'v2.0.3-amoled.3', 'arm64-v8a', () => assert.fail()));
});

test('missing checksums stop the download rather than installing an unchecked APK', async () => {
    const data = release(); data.assets[1].digest = null;
    await assert.rejects(() => prepareUpdate(data, 'v2.0.3-amoled.3', 'arm64-v8a', () => assert.fail()));
});
