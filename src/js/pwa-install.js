let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();           // evita o prompt automático
  deferredPrompt = e;           // guarda o evento para uso posterior
  // aqui você pode decidir quando disparar; exemplo: 5 segundos depois
  setTimeout(showInstallPrompt, 5000);
});

async function showInstallPrompt() {
  if (!deferredPrompt) return;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  promptEvent.prompt();         // mostra o prompt nativo do navegador
  const { outcome } = await promptEvent.userChoice;
  // outcome: 'accepted' ou 'dismissed' — útil para métricas
}
