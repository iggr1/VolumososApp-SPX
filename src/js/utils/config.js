import { apiGet } from "../api.js";

const CONFIG_CACHE_MS = 5 * 60 * 1000;
let lastConfig = null;
let lastConfigAt = 0;
let configInFlight = null;

export async function fetchConfig(options = {}) {
  const { force = false } = options;

  const now = Date.now();
  if (!force && lastConfig && (now - lastConfigAt) < CONFIG_CACHE_MS) {
    return lastConfig;
  }

  if (configInFlight) return configInFlight;

  configInFlight = apiGet('config')
    .then((cfg) => {
      if (cfg) {
        lastConfig = cfg;
        lastConfigAt = Date.now();
      }
      return cfg;
    })
    .finally(() => { configInFlight = null; });

  return configInFlight;
}

export function getConfigs(options = {}) {
  const { force = false } = options;

  (async function () {
    try {
      const config = await fetchConfig({ force });
      applyConfig(config);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  })();

  return configInFlight || Promise.resolve(lastConfig);
}

function applyConfig(config) {
  if (config?.hub) {
    const { max_packages, letter_range, number_range } = config.hub;
    if (max_packages) localStorage.setItem('maxPackages', max_packages);
    if (letter_range) localStorage.setItem('letterRange', letter_range);
    if (number_range) localStorage.setItem('numberRange', number_range);
  }
}