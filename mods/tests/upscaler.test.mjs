import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supportsUpscaler, upscalerCommand } from '../utils/upscaler.js';

test('upscaler controls are sent only to APKs with the native renderer', () => {
    const bridge = version => ({ GetVersion: () => version, InstallAppFromURL() {} });
    for (const version of ['v2.0.3-amoled.5', '2.0.3-amoled.10', 'v2.0.4-amoled.1', 'v2.1.0-amoled.1', 'v3.0.0-amoled.1'])
        assert.equal(supportsUpscaler(bridge(version)), true, version);
    for (const version of ['v2.0.3-amoled.4', 'v2.0.2-amoled.90', '2.0.3', 'unknown'])
        assert.equal(supportsUpscaler(bridge(version)), false, version);
    assert.equal(supportsUpscaler(null), false);
    assert.equal(supportsUpscaler({ GetVersion: () => 'v2.0.3-amoled.5' }), false);
});

test('local native commands use the explicit allowlist; never form APK requests', () => {
    for (const mode of ['auto', 'off', 'quality']) assert.equal(upscalerCommand(mode), 'tizentube://upscaler/' + mode);
    for (const value of [null, undefined, 'auto?url=https://example.com', 'other']) assert.equal(upscalerCommand(value), 'tizentube://upscaler/off');
});
