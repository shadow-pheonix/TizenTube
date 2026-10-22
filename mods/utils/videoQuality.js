// Quality choices come from the player, which knows the device/account limits.
// Streaming metadata only supplies bitrates; it never adds unsupported choices.
const HEIGHTS = { tiny: 144, small: 240, medium: 360, large: 480, hd720: 720, hd1080: 1080, hd1440: 1440, hd2160: 2160, hd2880: 2880 };
const responses = new Map();

export function rememberQualityFormats(response) {
    const id = response?.videoDetails?.videoId;
    const streaming = response?.streamingData;
    if (!id || !streaming) return;
    responses.delete(id);
    responses.set(id, [...(streaming.adaptiveFormats || []), ...(streaming.formats || [])]);
    if (responses.size > 8) responses.delete(responses.keys().next().value);
}

export function qualityHeight(choice) {
    const label = /([0-9]{2,5})p/i.exec(choice.qualityLabel || '');
    return Number(label?.[1]) || Number(choice.height) || HEIGHTS[choice.quality] || Number(/^hd([0-9]+)$/.exec(choice.quality || '')?.[1]) || 0;
}

function positive(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
}

export function availableQualities(player) {
    let formats = [];
    const videoId = player?.getVideoData?.()?.video_id;
    try {
        let response = player?.getPlayerResponse?.();
        if (typeof response === 'string') response = JSON.parse(response);
        if (response?.videoDetails?.videoId === videoId) rememberQualityFormats(response);
    } catch (_) { /* Metadata is optional; quality selection still works. */ }
    formats = responses.get(videoId) || [];
    const data = player?.getAvailableQualityData?.() || [];
    const choices = [];
    for (const choice of data) {
        if (!choice?.quality || choice.quality === 'auto' || choice.isPlayable === false) continue;
        if (choice.paygatedQualityDetails && choice.isPlayable !== true) continue;
        const height = qualityHeight(choice);
        if (!height) continue;
        const formatId = choice.formatId;
        const itag = String(formatId || '').match(/^([0-9]+)(?:$|[;,])/)?.[1];
        const exact = formats.find(format => String(format.itag) === itag && format.mimeType?.startsWith('video/'));
        const reported = positive(choice.bitrate) || positive(choice.averageBitrate);
        const exactBitrate = positive(exact?.bitrate) || positive(exact?.averageBitrate);
        const bitrate = reported || exactBitrate;
        const item = {
            quality: choice.quality, qualityLabel: choice.qualityLabel || `${height}p`,
            formatId, height, bitrate: bitrate || null,
            sourceOrder: choices.length,
        };
        if (!choices.some(existing => qualityKey(existing) === qualityKey(item))) choices.push(item);
    }
    return choices.sort((a, b) => b.height - a.height || (b.bitrate || 0) - (a.bitrate || 0));
}

export function qualityKey(choice) {
    return `${choice.quality}:${choice.formatId ?? ''}`;
}

export function selectQuality(choices, preference, preferHighestBitrate = true) {
    if (!preference || preference === 'auto' || !choices.length) return null;
    const ceiling = preference === 'highest' ? Infinity : Number.parseInt(preference, 10);
    if (!(ceiling > 0)) return null;
    const below = choices.filter(choice => choice.height <= ceiling);
    // When every available tier is above the requested ceiling, use the lowest
    // actual tier rather than an invented/unavailable quality ID.
    const height = below.length ? Math.max(...below.map(choice => choice.height)) : Math.min(...choices.map(choice => choice.height));
    const variants = choices.filter(choice => choice.height === height);
    return preferHighestBitrate
        ? variants.reduce((best, choice) => (choice.bitrate || 0) > (best.bitrate || 0) ? choice : best)
        : variants.reduce((first, choice) => (choice.sourceOrder ?? 0) < (first.sourceOrder ?? 0) ? choice : first);
}

export function bitrateLabel(choice) {
    if (!choice.bitrate) return null;
    const value = choice.bitrate >= 1000000
        ? `${(choice.bitrate / 1000000).toFixed(2).replace(/\.?0+$/, '')} Mbps`
        : `${Math.round(choice.bitrate / 1000)} kbps`;
    return value;
}
