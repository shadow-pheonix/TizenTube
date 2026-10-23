export const FORK_REPOSITORY = 'shadow-pheonix/TizenTubeCobalt';
export const RELEASES_URL = `https://api.github.com/repos/${FORK_REPOSITORY}/releases/latest`;
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-amoled\.(\d+))?$/;

export function compareVersions(first, second) {
    const parse = version => {
        const match = VERSION.exec(version || '');
        if (!match) throw new Error('Unrecognized installed or release version');
        return match.slice(1).map(part => Number(part || 0));
    };
    const a = parse(first), b = parse(second);
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    }
    return 0;
}

export function selectUpdate(release, currentVersion, architecture) {
    if (release.draft || release.prerelease || !/^v?\d+\.\d+\.\d+-amoled\.\d+$/.test(release.tag_name || '')) {
        throw new Error('Not a published fork release');
    }
    if (compareVersions(release.tag_name, currentVersion) <= 0) return null;
    const suffix = architecture === 'arm64-v8a' ? 'arm64' : architecture === 'armeabi-v7a' ? 'arm' : null;
    if (!suffix) throw new Error('Unsupported APK architecture');
    const name = `TizenTube-AMOLED-${suffix}.apk`;
    const asset = release.assets?.find(item => item.name === name);
    if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 1024 * 1024 * 1024) {
        throw new Error('Matching APK is not available');
    }
    const expectedUrl = `https://github.com/${FORK_REPOSITORY}/releases/download/${release.tag_name}/${name}`;
    if (asset.browser_download_url !== expectedUrl) throw new Error('Unexpected update download URL');
    return { version: release.tag_name, asset, url: expectedUrl };
}

export async function prepareUpdate(release, currentVersion, architecture, fetcher, manual = false) {
    const update = selectUpdate(release, currentVersion, architecture);
    if (!update) return null;
    let digest = /^sha256:([a-f0-9]{64})$/i.exec(update.asset.digest || '')?.[1]?.toLowerCase();
    if (!digest) {
        const sums = release.assets.find(item => item.name === 'SHA256SUMS');
        const expected = `https://github.com/${FORK_REPOSITORY}/releases/download/${update.version}/SHA256SUMS`;
        if (sums?.browser_download_url !== expected) throw new Error('APK checksum is unavailable');
        const response = await fetcher(expected);
        if (!response.ok) throw new Error('Could not fetch APK checksums');
        const text = await response.text();
        if (text.length > 65536) throw new Error('Invalid checksum metadata');
        for (const line of text.split(/\r?\n/)) {
            const entry = /^([a-f0-9]{64})\s+\*?([^\s]+)$/i.exec(line.trim());
            if (entry?.[2] === update.asset.name) digest = entry[1].toLowerCase();
        }
    }
    if (!digest) throw new Error('Missing APK checksum');
    return `${update.url}#version=${encodeURIComponent(update.version)}&sha256=${digest}&size=${update.asset.size}&manual=${manual ? '1' : '0'}`;
}
