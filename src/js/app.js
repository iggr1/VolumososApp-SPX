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

export function startGetConfigLoop() {
  (async function loop() {
    try {
      const config = await apiGet('config');
      applyConfig(config);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(loop, 300000);
    }
  })();
}

function applyConfig(config) {
  if (config?.hub) {
    const { max_packages, letter_range, number_range } = config.hub;
    if (max_packages) localStorage.setItem('maxPackages', max_packages);
    if (letter_range) localStorage.setItem('letterRange', letter_range);
    if (number_range) localStorage.setItem('numberRange', number_range);
  }
}
