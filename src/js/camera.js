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
    // (1) Se necessário, re-enumera dispositivos
    if (!this.devices.length) {
      try { await this.enumerate(); }
      catch (e) { throw e; }
    }

    // Atualiza índice desejado
    if (typeof index === 'number') this.currentIdx = index;

    // Fecha stream anterior
    this.stop();

    // Pré-constraints
    const preferId = this.devices[this.currentIdx]?.deviceId || null;
    const envConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }
      }
    };

    const byIdConstraints = (id) => ({
      video: {
        deviceId: { exact: id },
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 }
      }
    });

    let lastErr = null;

    // Tentativa A: abrir pelo deviceId selecionado
    if (preferId) {
      try {
        await this._open(byIdConstraints(preferId));
        this._afterOpen(preferId);
        return;
      } catch (e) {
        lastErr = e;
        if (this._isHardDeviceError(e)) {
          console.warn('[Camera] Falha ao abrir ID preferido, tentando fallback...', e.name, e.message);
        } else {
          throw e;
        }
      }
    }

    // Tentativa B: sem deviceId, pedindo a "traseira" (environment)
    try {
      await this._open(envConstraints);
      const usedId = this._getUsedDeviceId();
      this._afterOpen(usedId);
      return;
    } catch (e) {
      lastErr = e;
      if (!this._isHardDeviceError(e)) throw e;
      console.warn('[Camera] Fallback environment falhou, tentando outras câmeras...', e.name, e.message);
    }

    // Tentativa C: iterar por todos os devices conhecidos
    for (let i = 0; i < this.devices.length; i++) {
      const dev = this.devices[i];
      if (!dev?.deviceId) continue;
      try {
        await this._open(byIdConstraints(dev.deviceId));
        this.currentIdx = i;
        this._afterOpen(dev.deviceId);
        return;
      } catch (e) {
        lastErr = e;
        if (!this._isHardDeviceError(e)) throw e;
      }
    }

    // Nada deu certo
    const friendly = (lastErr && lastErr.name) ? lastErr.name : 'NotReadableError';
    console.warn(
      '[Camera] Não foi possível iniciar nenhuma câmera.',
      'Feche outros apps/abas que usam a câmera (Zoom/Meet/WhatsApp),',
      'verifique permissões do navegador/SO e tente novamente.'
    );
    throw new Error(`Falha ao iniciar câmera (${friendly}).`);
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
    } catch { /* ignore */ }
  }

  _getUsedDeviceId() {
    try {
      const [track] = this.stream?.getVideoTracks?.() || [];
      return track?.getSettings?.().deviceId || null;
    } catch { return null; }
  }

  _afterOpen(usedId) {
    if (usedId) {
      this.saveLastDeviceId(usedId);
      const idx = this.devices.findIndex(d => d.deviceId === usedId);
      if (idx >= 0) this.currentIdx = idx;
    }
    this.selectLabel.textContent = this.devices[this.currentIdx]?.label || `Câmera ${this.currentIdx + 1}`;
  }

  _isHardDeviceError(e) {
    // Erros típicos de hardware/ocupado/constraints
    return ['NotReadableError','OverconstrainedError','NotFoundError'].includes(e?.name);
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
    try { localStorage.setItem(CameraController.STORAGE_KEY, deviceId); }
    catch {}
  }
}
