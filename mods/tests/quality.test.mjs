import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableQualities, selectQuality, rememberQualityFormats, qualityKey, bitrateLabel } from '../utils/videoQuality.js';
import { QualityController } from '../features/qualityController.js';

function quality(height, bitrate, formatId) {
    return { quality: height >= 4320 ? 'highres' : `hd${height}`, qualityLabel: `${height}p`, height, bitrate, formatId, isPlayable: true };
}

test('2160p default chooses 2160p and never jumps to available 4320p', () => {
    const choices = [quality(1080), quality(4320), quality(2160), quality(1440)];
    assert.equal(selectQuality(choices, '2160p').height, 2160);
});

test('missing 2160p falls back to the best lower tier even with higher tiers present', () => {
    const choices = [quality(4320), quality(720), quality(1440), quality(1080)];
    assert.equal(selectQuality(choices, '2160p').height, 1440);
    assert.equal(selectQuality(choices, '1080p').height, 1080);
    assert.equal(selectQuality([quality(480), quality(360)], '2160p').height, 480);
});

test('Highest available has no hard-coded resolution cap', () => {
    assert.equal(selectQuality([quality(2160), quality(8640), quality(4320)], 'highest').height, 8640);
});

test('same-resolution choices prefer the highest reported bitrate', () => {
    assert.equal(selectQuality([quality(2160, 8000000, '313'), quality(2160, 18000000, '315')], '2160p').formatId, '315');
    assert.equal(selectQuality([quality(2160, 18000000, '315'), quality(4320, 1000000, '571')], 'highest').height, 4320);
});

test('no metadata and Auto never invent a quality; the lowest real tier is the last resort', () => {
    assert.equal(selectQuality([], '2160p'), null);
    assert.equal(selectQuality([quality(2160)], 'auto'), null);
    assert.equal(selectQuality([quality(2160)], 'invalid'), null);
    assert.equal(selectQuality([quality(1080), quality(720)], '144p').height, 720);
});

test('only playable player choices are exposed, with bitrates from matching format IDs', () => {
    const player = {
        getVideoData: () => ({ video_id: 'metadata-video' }),
        getAvailableQualityData: () => [quality(2160, null, '315'), { ...quality(4320, null, '571'), isPlayable: false },
            { ...quality(1080, null, '616'), isPlayable: undefined, paygatedQualityDetails: {} }],
    };
    rememberQualityFormats({ videoDetails: { videoId: 'metadata-video' }, streamingData: { adaptiveFormats: [
        { itag: 315, height: 2160, mimeType: 'video/webm', bitrate: 18000000 },
        { itag: 571, height: 4320, mimeType: 'video/webm', bitrate: 40000000 },
        { itag: 140, mimeType: 'audio/mp4', bitrate: 128000 },
    ] } });
    const choices = availableQualities(player);
    assert.equal(choices.length, 1);
    assert.equal(choices[0].bitrate, 18000000);
    assert.equal(bitrateLabel(choices[0]), '18 Mbps');
});

test('a generic tier never guesses its bitrate or invents a format ID', () => {
    const player = { getVideoData: () => ({ video_id: 'upper-bound' }), getAvailableQualityData: () => [quality(1080)] };
    rememberQualityFormats({ videoDetails: { videoId: 'upper-bound' }, streamingData: { adaptiveFormats: [
        { itag: 137, height: 1080, mimeType: 'video/mp4', bitrate: 4000000 },
    ] } });
    const choice = availableQualities(player)[0];
    assert.equal(choice.formatId, undefined);
    assert.equal(bitrateLabel(choice), null);
});

test('bitrates from a previous video are never reused', () => {
    const player = { getVideoData: () => ({ video_id: 'unreported-video' }), getAvailableQualityData: () => [quality(2160, null, '315')],
        getPlayerResponse: () => ({ videoDetails: { videoId: 'metadata-video' }, streamingData: { adaptiveFormats: [{ itag: 315, mimeType: 'video/webm', bitrate: 1 }] } }) };
    assert.equal(availableQualities(player)[0].bitrate, null);
    assert.equal(bitrateLabel(availableQualities(player)[0]), null);
});

test('FPS and HDR labels preserve their actual resolution', () => {
    const player = { getVideoData: () => ({}), getAvailableQualityData: () => [{ quality: 'highres', qualityLabel: '2160p60 HDR', formatId: '337' }] };
    assert.equal(availableQualities(player)[0].height, 2160);
});

function fixture() {
    const calls = [];
    const config = { preferredVideoQuality: '2160p', preferHighestBitrate: true };
    let time = 0;
    const player = {
        videoId: 'first', choices: [], current: 'hd720', inline: false,
        getVideoData() { return { video_id: this.videoId }; },
        getAvailableQualityData() { return this.choices; },
        getPlaybackQuality() { return this.current; },
        isInline() { return this.inline; },
        setPlaybackQualityRange(...args) { calls.push(args); this.current = args[0]; },
        setPlaybackQuality(value) { calls.push(['adaptive', value]); },
    };
    let active = player;
    const controller = new QualityController({ getPlayer: () => active, readConfig: key => config[key], now: () => time });
    return { controller, player, calls, config, replace: next => active = next, advance: ms => time += ms };
}

test('empty quality data retries, late 2160p upgrades a temporary fallback, and calls are deduplicated', () => {
    const { controller, player, calls } = fixture();
    controller.tick();
    assert.equal(calls.length, 0);
    player.choices = [quality(720)];
    controller.tick();
    assert.deepEqual(calls.at(-1), ['hd720', 'hd720']);
    player.choices = [quality(720), quality(2160, 18000000, '315')];
    controller.tick();
    assert.deepEqual(calls.at(-1), ['hd2160', 'hd2160', '315']);
    controller.tick();
    assert.equal(calls.length, 2);
});

test('each new video reapplies the default with its own lower-resolution fallback', () => {
    const { controller, player, calls } = fixture();
    player.choices = [quality(2160)]; controller.tick();
    player.videoId = 'second'; player.choices = [quality(720), quality(1080)]; controller.tick();
    assert.deepEqual(calls.at(-1), ['hd1080', 'hd1080']);
});

test('manual quality overrides persist on one video and the next video returns to the default', () => {
    const { controller, player, calls } = fixture();
    player.choices = [quality(2160), quality(720)]; controller.tick();
    assert.equal(controller.setManualQuality({ videoId: 'first', mode: 'variant', key: qualityKey(quality(720)) }), true);
    controller.tick();
    assert.deepEqual(calls.at(-1), ['hd720', 'hd720']);
    player.videoId = 'second'; controller.tick();
    assert.deepEqual(calls.at(-1), ['hd2160', 'hd2160']);
});

test('stale video and unavailable manual choices are rejected', () => {
    const { controller, player } = fixture();
    player.choices = [quality(2160)]; controller.tick();
    assert.equal(controller.setManualQuality({ videoId: 'old', mode: 'highest' }), false);
    assert.equal(controller.setManualQuality({ videoId: 'first', mode: 'variant', key: 'locked:616' }), false);
});

test('switching the default to Auto releases the previous forced quality range', () => {
    const { controller, player, config, calls } = fixture();
    player.choices = [quality(2160)]; controller.tick();
    config.preferredVideoQuality = 'auto'; controller.configChanged();
    assert.deepEqual(calls.slice(-2), [['tiny', 'highres'], ['adaptive', 'auto']]);
});

test('manual Auto survives rechecks and the next video restores the saved default', () => {
    const { controller, player, calls } = fixture();
    player.choices = [quality(2160)]; controller.tick();
    controller.setManualQuality({ videoId: 'first', mode: 'auto' });
    controller.tick(); assert.deepEqual(calls.at(-1), ['adaptive', 'auto']);
    player.videoId = 'second'; controller.tick(); assert.deepEqual(calls.at(-1), ['hd2160', 'hd2160']);
});

test('disabled highest-bitrate preference leaves format selection adaptive', () => {
    const { controller, player, config, calls } = fixture();
    config.preferHighestBitrate = false;
    player.choices = [quality(2160, 18000000, '315')]; controller.tick();
    assert.deepEqual(calls.at(-1), ['hd2160', 'hd2160']);
});

test('default quality is restored after a player downshift, with a retry interval', () => {
    const { controller, player, calls, advance } = fixture();
    player.choices = [quality(2160)]; controller.tick();
    player.current = 'hd720'; controller.tick(); assert.equal(calls.length, 1);
    advance(3000); controller.tick(); assert.equal(calls.length, 2);
});

test('replacing the player reattaches and applies the saved preference', () => {
    const f = fixture(); f.player.choices = [quality(2160)]; f.controller.tick();
    const replacement = { ...f.player, choices: [quality(1080)], videoId: 'replacement' };
    f.replace(replacement); f.controller.tick();
    assert.deepEqual(f.calls.at(-1), ['hd1080', 'hd1080']);
});

test('inline previews are not forced to the full-video default', () => {
    const { controller, player, calls } = fixture();
    player.choices = [quality(2160)]; player.inline = true; controller.tick();
    assert.equal(calls.length, 0);
    player.inline = false; controller.tick(); assert.equal(calls.length, 1);
});
