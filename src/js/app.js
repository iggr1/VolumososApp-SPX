import { apiGet } from './api.js';

export const $ = (s, r = document) => r.querySelector(s);

export function setupTypography() {
    const root = document.documentElement;
    const initial = parseFloat(getComputedStyle(root).fontSize);
    const wrapY = $('.wrap-y');
    const x = $('.wrap-x'), y = $('.wrap-y');
    x.style.aspectRatio = y.style.aspectRatio = `${innerWidth} / ${innerHeight}`;
    function update() {
        const pct = wrapY.offsetHeight / innerHeight;
        root.style.setProperty('--font-size', `${initial * pct}px`);
    }
    addEventListener('resize', update);
    update();
}
