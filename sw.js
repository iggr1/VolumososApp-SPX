const CACHE_VERSION = 'volumososapp-cache-v1';

const buildBasePath = () => {
  const { pathname } = new URL(self.registration.scope);
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
};

const BASE_PATH = buildBasePath();

const toUrl = (path) => {
  if (!path) return new URL(BASE_PATH, self.location.origin).toString();
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return new URL(`${BASE_PATH}${normalized}`, self.location.origin).toString();
};

const PRECACHE_URLS = [
  '',
  'index.html',
  'data/hubs.json',
  'src/css/global.css',
  'src/css/main.css',
  'src/css/alerts.css',
  'src/css/modal.css',
  'src/js/main.js',
  'src/js/app.js',
  'src/js/camera.js',
  'src/js/scanner.js',
  'src/js/modal.js',
  'src/js/api.js',
  'src/js/utils/auth.js',
  'src/js/utils/config.js',
  'src/js/utils/hubPicker.js',
  'src/js/utils/pallet.js',
  'src/js/utils/uiSelect.js',
  'src/js/utils/package.js',
  'src/js/utils/alerts.js',
  'src/js/utils/helper.js',
  'src/js/utils/user.js',
  'src/js/modals/menu.js',
  'src/js/modals/about.js',
  'src/js/modals/currentPallet.js',
  'src/js/modals/allPallets.js',
  'src/js/modals/palletDetails.js',
  'src/js/modals/profile.js',
  'src/js/modals/settings.js',
  'src/js/modals/users.js',
  'src/js/modals/userEdit.js',
  'src/js/modals/avatar.js',
  'src/js/modals/routeSelect.js',
  'src/js/modals/login.js',
  'src/js/modals/register.js',
  'src/assets/img/spx-logo.png',
  'src/assets/favicons/pallet-icon.svg',
  'src/assets/favicons/favicon-light.svg',
  'src/assets/favicons/favicon-dark.svg'
].map(toUrl);

// Set para consulta rápida
const PRECACHE_SET = new Set(PRECACHE_URLS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key === CACHE_VERSION ? null : caches.delete(key)))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Se NÃO está na lista de pré-cache:
  // deixa ir direto pra rede, sem cache (nem leitura nem gravação)
  if (!PRECACHE_SET.has(request.url)) {
    return;
  }

  // Só para os arquivos pré-cacheados usamos cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      // Se por algum motivo não estiver no cache, busca da rede,
      // mas NÃO grava no cache em tempo de execução.
      return fetch(request);
    })
  );
});
