import { apiGet } from "../api.js";

export async function fetchConfig() {
    return await apiGet('config');
}

export function getConfigs() {
  (async function () {
    try {
      const config = await apiGet('config');
      applyConfig(config);
    } catch (err) {
      console.error('Failed to fetch config:', err);
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