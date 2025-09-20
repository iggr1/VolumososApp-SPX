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
    let all = await navigator.mediaDevices.enumerateDevices();
    this.devices = all.filter(d => d.kind === 'videoinput');
    if (!this.devices.length) throw new Error('Sem câmera disponível');

    // Se labels vierem vazias (comum antes de permissão), dá um prime rápido:
    const hasLabels = this.devices.some(d => d.label && d.label.trim());
    if (!hasLabels) {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach(t => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
        this.devices = all.filter(d => d.kind === 'videoinput');
      } catch {} // se falhar, segue sem labels
    }

    const lastId = this.getLastDeviceId();
    if (lastId) {
      const idx = this.devices.findIndex(d => d.deviceId === lastId);
      if (idx >= 0) this.currentIdx = idx;
    } else {
      // Se não tem última, preferir traseira por heurística
      const idxEnv = this.findByLabelFacing('environment');
      if (idxEnv >= 0) this.currentIdx = idxEnv;
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
    if (!this.devices.length) await this.enumerate();
    if (typeof index === 'number') this.currentIdx = index;

    this.stop();

    const byId = (id) => ({
      video: {
        deviceId: { exact: id },
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }
      }
    });
    const envExact = {
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }
      }
    };
    const envIdeal = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }
      }
    };

    let usedId = null;

    // 1) Tenta o último/selecionado por deviceId
    const preferId = this.devices[this.currentIdx]?.deviceId;
    if (preferId) {
      try {
        await this._open(byId(preferId));
        usedId = this._getUsedDeviceId() || preferId;
        this._finalizeAfterOpen(usedId);
        return;
      } catch (e) {
        // segue para fallback
      }
    }

    // 2) Força environment (exact). iOS/Android respeitam melhor isso.
    try {
      await this._open(envExact);
      usedId = this._getUsedDeviceId();
      if (usedId) {
        const idx = this.devices.findIndex(d => d.deviceId === usedId);
        if (idx >= 0) this.currentIdx = idx;
      } else {
        // Se não retornou usedId, tenta mapear por label pro índice
        const idxEnv = this.findByLabelFacing('environment');
        if (idxEnv >= 0) this.currentIdx = idxEnv;
      }
      this._finalizeAfterOpen(usedId);
      return;
    } catch (e) {
      // segue para próximo fallback
    }

    // 3) Tenta environment (ideal)
    try {
      await this._open(envIdeal);
      usedId = this._getUsedDeviceId();
      if (usedId) {
        const idx = this.devices.findIndex(d => d.deviceId === usedId);
        if (idx >= 0) this.currentIdx = idx;
      } else {
        const idxEnv = this.findByLabelFacing('environment');
        if (idxEnv >= 0) this.currentIdx = idxEnv;
      }
      this._finalizeAfterOpen(usedId);
      return;
    } catch (e) {
      // segue
    }

    // 4) Heurística por label: tenta abrir explicitamente o que parece "traseira"
    const idxByLabel = this.findByLabelFacing('environment');
    if (idxByLabel >= 0) {
      try {
        await this._open(byId(this.devices[idxByLabel].deviceId));
        this.currentIdx = idxByLabel;
        usedId = this._getUsedDeviceId();
        this._finalizeAfterOpen(usedId);
        return;
      } catch (e) { /* segue */ }
    }

    // 5) Último recurso: abre a primeira disponível
    await this._open({ video: true });
    usedId = this._getUsedDeviceId();
    if (usedId) {
      const idx = this.devices.findIndex(d => d.deviceId === usedId);
      if (idx >= 0) this.currentIdx = idx;
    }
    this._finalizeAfterOpen(usedId);
  }

  async _open(constraints) {
    this.stop();
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
    } catch {}
  }

  _getUsedDeviceId() {
    try {
      const [track] = this.stream?.getVideoTracks?.() || [];
      return track?.getSettings?.().deviceId || null;
    } catch { return null; }
  }

  _finalizeAfterOpen(usedId) {
    if (usedId) this.saveLastDeviceId(usedId);
    this.selectLabel.textContent = this.devices[this.currentIdx]?.label || `Câmera ${this.currentIdx + 1}`;

    // Se a label indicar traseira, desliga espelho; senão, mantém:
    const label = (this.devices[this.currentIdx]?.label || '').toLowerCase();
    const looksBack = /(back|rear|traseir|environment|world)/i.test(label);
    this.mirrored = !looksBack;
    this.video.classList.toggle('mirror', this.mirrored);
  }

  findByLabelFacing(kind /* 'environment' | 'user' */) {
    const re = kind === 'environment'
      ? /(back|rear|traseir|environment|world)/i
      : /(front|user|frontal|face)/i;
    return this.devices.findIndex(d => re.test(String(d.label || '')));
  }

  stop() {
    if (this.stream) {
      try { this.stream.getTracks().forEach(t => t.stop()); } catch {}
      this.stream = null;
      this.video.srcObject = null;
    }
  }

  getLastDeviceId() {
    try { return localStorage.getItem(CameraController.STORAGE_KEY) || ''; }
    catch { return ''; }
  }
  saveLastDeviceId(deviceId) {
    console.log('Salvando última câmera usada:', deviceId);
    try { localStorage.setItem(CameraController.STORAGE_KEY, deviceId); }
    catch {}
  }
}
