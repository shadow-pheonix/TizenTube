import { configRead, configChangeEmitter } from '../config.js';

const style = document.createElement('style');
style.id = 'tizentube-theme';
// YouTube applies a nonce to its styles. Give our separate stylesheet the same
// nonce so theme changes work without modifying or accumulating in page styles.
const existingStyle = document.querySelector('style[nonce]');
if (existingStyle) {
    style.setAttribute('nonce', existingStyle.nonce || existingStyle.getAttribute('nonce'));
}

function updateStyle() {
    const amoled = configRead('enableAmoledTheme');
    if (amoled) {
        document.documentElement.setAttribute('data-tizentube-amoled', '');
    } else {
        document.documentElement.removeAttribute('data-tizentube-amoled');
    }
    style.textContent = `
    ytlr-guide-response yt-focus-container {
        background-color: ${amoled ? '#000000' : configRead('focusContainerColor')};
    }

    #container {
        background-color: ${amoled ? '#000000' : configRead('routeColor')} !important;
    }

    html[data-tizentube-amoled],
    html[data-tizentube-amoled] body,
    html[data-tizentube-amoled] ytlr-browse,
    html[data-tizentube-amoled] ytlr-search,
    html[data-tizentube-amoled] ytlr-guide-response yt-focus-container,
    html[data-tizentube-amoled] ytlr-overlay-panel-renderer,
    html[data-tizentube-amoled] ytlr-overlay-panel-header-renderer,
    html[data-tizentube-amoled] .ytLrOverlayPanelRenderer,
    html[data-tizentube-amoled] .ytLrOverlayPanelHeaderRenderer,
    html[data-tizentube-amoled] .ytaf-ui-container {
        background-color: #000000 !important;
        background-image: none !important;
    }
`;
}

document.head.appendChild(style);
updateStyle();
configChangeEmitter.addEventListener('configChange', (event) => {
    if (['enableAmoledTheme', 'focusContainerColor', 'routeColor'].indexOf(event.detail.key) !== -1) {
        updateStyle();
    }
});
export default updateStyle;
