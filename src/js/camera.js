export class CameraController {
  static STORAGE_KEY = 'camera:lastDeviceId';

  constructor({ camEl, selectBtn, flipBtn, selectLabel }) {
    this.camEl = camEl;
    this.selectBtn = selectBtn;
    this.flipBtn = flipBtn;
    this.selectLabel = selectLabel;

    this.video = document.createElement('video');
    this.video.className = 'cam-video';
    this.video.playsInline = true; this.video.muted = true; this.video.autoplay = true;
    camEl.prepend(this.video);

    this.selector = document.createElement('ul');
    this.selector.className = 'cam-selector';
    camEl.appendChild(this.selector);

    this.devices = [];
    this.currentIdx = 0;
    this.stream = null;
    this.mirrored = false;

    this.bindUI();
  }

  getVideo() { return this.video; }

  bindUI() {
    this.selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selector.classList.contains('show') ? this.hideSelector() : this.showSelector();
    });
    document.addEventListener('click', () => this.hideSelector());

    this.flipBtn.addEventListener('click', () => {
      this.mirrored = !this.mirrored;
      this.video.classList.toggle('mirror', this.mirrored);
    });
  }

  async enumerate() {
    const all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all.filter(d => d.kind === 'videoinput');
    if (!this.devices.length) throw new Error('Sem câmera disponível');

    // Restaura índice pela última câmera usada, se existir:
    const lastId = this.getLastDeviceId();
    if (lastId) {
      const idx = this.devices.findIndex(d => d.deviceId === lastId);
      if (idx >= 0) this.currentIdx = idx;
    }
  }

  buildSelector() {
    this.selector.innerHTML = '';
    this.devices.forEach((d, i) => {
      const li = document.createElement('li');
      li.textContent = d.label || `Câmera ${i + 1}`;
      if (i === this.currentIdx) li.classList.add('active');
      li.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.start(i);
        this.hideSelector();
      });
      this.selector.appendChild(li);
    });
  }
  showSelector() { this.buildSelector(); this.selector.classList.add('show'); }
  hideSelector() { this.selector.classList.remove('show'); }

  async start(index = this.currentIdx) {
    this.currentIdx = index;
    this.stop();

    const id = this.devices[index]?.deviceId;
    const constraints = {
      video: {
        ...(id ? { deviceId: { exact: id } } : { facingMode: 'environment' }),
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }
      }
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    await this.video.play();

    try {
      const [track] = this.stream.getVideoTracks();
      const caps = track.getCapabilities?.() || {};
      const adv = [];
      if (caps.focusMode?.includes?.('continuous')) adv.push({ focusMode: 'continuous' });
      if (typeof caps.focusDistance?.max === 'number') adv.push({ focusDistance: caps.focusDistance.max });
      if (adv.length) await track.applyConstraints({ advanced: adv });

      // Salva o deviceId efetivamente usado (mais confiável via settings)
      const usedId = track.getSettings?.().deviceId || id || null;
      if (usedId) {
        this.saveLastDeviceId(usedId);
        // Atualiza currentIdx se a lista mudar de ordem em outro momento
        const idx = this.devices.findIndex(d => d.deviceId === usedId);
        if (idx >= 0) this.currentIdx = idx;
      }
    } catch { /* silencioso */ }

    this.selectLabel.textContent = this.devices[this.currentIdx]?.label || `Câmera ${this.currentIdx + 1}`;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  // Persistência da última câmera
  getLastDeviceId() {
    try { return localStorage.getItem(CameraController.STORAGE_KEY) || ''; }
    catch { return ''; }
  }
  saveLastDeviceId(deviceId) {
    try { localStorage.setItem(CameraController.STORAGE_KEY, deviceId); }
    catch { /* storage indisponível */ }
  }
}
