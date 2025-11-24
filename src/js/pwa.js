const detectBasePath = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last.includes('.')) parts.pop();
  return parts.length ? `/${parts.join('/')}/` : '/';
};

const normalizePath = (path, basePath) => {
  if (!path) return basePath;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${basePath}${normalized}`;
};

const createManifest = (basePath) => ({
  name: 'VolumososApp SPX',
  short_name: 'VolumososApp',
  start_url: basePath,
  scope: basePath,
  display: 'standalone',
  orientation: 'portrait',
  description: 'Aplicação de coleta e controle de pallets com suporte offline.',
  background_color: '#111111',
  theme_color: '#ef4c29',
  id: basePath,
  icons: [
    { src: normalizePath('src/assets/favicons/favicon-light.svg', basePath), sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
  ]
});

const ensureManifest = (manifest) => {
  const existing = document.querySelector('link[rel="manifest"]');
  if (existing) return existing;

  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const manifestUrl = URL.createObjectURL(manifestBlob);

  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = manifestUrl;
  document.head.appendChild(link);
  return link;
};

const registerServiceWorker = async (basePath) => {
  if (!('serviceWorker' in navigator)) return null;

  const swPath = `${basePath}sw.js`;
  try {
    const registration = await navigator.serviceWorker.register(swPath, { scope: basePath });
    return registration;
  } catch (error) {
    console.error('[PWA] Falha ao registrar service worker', error);
    return null;
  }
};

export const setupPWA = async () => {
  const basePath = window.__APP_BASE_PATH__ || detectBasePath();
  window.__APP_BASE_PATH__ = basePath;

  const manifest = createManifest(basePath);
  ensureManifest(manifest);

  return registerServiceWorker(basePath);
};
