export class CameraController {
  constructor({ camEl, selectBtn, flipBtn, selectLabel }) {
    this.camEl = camEl;
    this.selectBtn = selectBtn;
    this.flipBtn = flipBtn;
    this.selectLabel = selectLabel;

    this.video = document.createElement('video');
    this.video.className = 'cam-video';
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    camEl.prepend(this.video);

    this.selector = document.createElement('ul');
    this.selector.className = 'cam-selector';
    camEl.appendChild(this.selector);

    this.allDevices = [];
    this.working = [];
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
    // lista inicial
    let all = await navigator.mediaDevices.enumerateDevices();
    this.allDevices = all.filter(d => d.kind === 'videoinput');
    if (!this.allDevices.length) throw new Error('Sem câmera disponível');

    // se não há labels, faz um getUserMedia rápido para “desbloquear” labels
    const hasLabels = this.allDevices.some(d => d.label && d.label.trim());
    if (!hasLabels) {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach(t => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
        this.allDevices = all.filter(d => d.kind === 'videoinput');
      } catch {}
    }

    await this._probeWorkingDevices(); // preenche this.working apenas com as que abrem
  }

  // ======== Helpers de plataforma/estratégia ========
  _isAppleLike() {
    const ua = navigator.userAgent || '';
    return /(iPhone|iPad|iPod)/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  }

  _canUseDeviceId() {
    // se estiver em iOS/Safari, normalmente deviceId não é confiável; caia para facingMode
    const ids = this.allDevices.map(d => d.deviceId).filter(Boolean);
    return !this._isAppleLike() && new Set(ids).size > 1;
  }

  // ======== Descoberta de câmeras funcionais ========
  async _probeWorkingDevices() {
    this.working = [];

    const canById = this._canUseDeviceId();

    if (canById) {
      // heurística: traseiras primeiro, depois as neutras, depois o resto
      const looksBack  = (s) => /(back|rear|traseir|environment|world|wide)/i.test(String(s||''));
      const looksFront = (s) => /(front|user|frontal|face|selfie)/i.test(String(s||''));

      const envFirst = this.allDevices.filter(d => looksBack(d.label));
      const notFront = this.allDevices.filter(d => !looksBack(d.label) && !looksFront(d.label));
      const theRest  = this.allDevices.filter(d => !envFirst.includes(d) && !notFront.includes(d));
      const ordered  = [...envFirst, ...notFront, ...theRest];

      for (const dev of ordered) {
        const ok = await this._testOpen(dev.deviceId);
        if (ok) this.working.push(ok);
      }
    } else {
      // iOS/Safari/WebView: crie “entradas virtuais” por facingMode
      const env = await this._testOpen(null, false, 'environment');
      if (env) this.working.push(env);

      const usr = await this._testOpen(null, false, 'user');
      if (usr) this.working.push(usr);

      // se ainda vazio, tente um genérico (pelo menos uma)
      if (this.working.length === 0) {
        const tryGen = await this._testOpen(null, true);
        if (tryGen) this.working.push(tryGen);
      }
    }

    if (this.working.length === 0) throw new Error('Nenhuma câmera funcional foi encontrada');
  }

  async _testOpen(deviceId, generic = false, mode = null) {
    let constraints;
    if (mode) {
      // força abrir por facingMode (ideal)
      constraints = { video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } } };
    } else if (generic) {
      // tentativa genérica para ter ao menos uma câmera
      constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } };
    } else {
      // seleção normal por deviceId quando possível
      constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      };
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings?.() || {};
      const usedId = settings.deviceId || deviceId || '';
      const facing = (mode || settings.facingMode || this._guessFacingByLabel(this._labelOf(usedId)) || '').toLowerCase();
      const label  = mode === 'environment' ? 'Traseira'
                   : mode === 'user'        ? 'Frontal'
                   : this._labelOf(usedId);
      return { deviceId: usedId, label, facing, _byFacing: Boolean(mode) };
    } catch {
      return null;
    } finally {
      try { stream?.getTracks?.().forEach(t => t.stop()); } catch {}
    }
  }

  _labelOf(deviceId) {
    const d = this.allDevices.find(x => x.deviceId === deviceId);
    return d?.label || '';
  }

  _guessFacingByLabel(label) {
    const s = String(label || '').toLowerCase();
    if (/(back|rear|traseir|environment|world|wide)/i.test(s)) return 'environment';
    if (/(front|user|frontal|face|selfie)/i.test(s)) return 'user';
    return 'unknown';
  }

  // ======== UI do seletor ========
  buildSelector() {
    this.selector.innerHTML = '';
    this.working.forEach((d, i) => {
      const li = document.createElement('li');
      li.textContent = this._friendlyName(d, i);
      if (i === this.currentIdx) li.classList.add('active');
      li.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.start(i, { preferBack: false }); // respeita escolha do usuário
        this.hideSelector();
      });
      this.selector.appendChild(li);
    });
  }
  showSelector() { this.buildSelector(); this.selector.classList.add('show'); }
  hideSelector() { this.selector.classList.remove('show'); }

  _friendlyName(d, idx) {
    if ((d.facing || '').toLowerCase() === 'environment' || /(back|rear|traseir|environment|world|wide)/i.test(d.label)) {
      return 'Traseira';
    }
    if ((d.facing || '').toLowerCase() === 'user' || /(front|user|frontal|face|selfie)/i.test(d.label)) {
      return 'Frontal';
    }
    return `Câmera ${idx + 1}`;
  }

  // ======== Abertura efetiva do stream ========
  async start(index = undefined, { preferBack = true } = {}) {
    if (!this.working.length) await this.enumerate();

    let targetIdx = 0;
    if (typeof index === 'number') {
      targetIdx = Math.max(0, Math.min(index, this.working.length - 1));
    } else if (preferBack) {
      const iBack = this.working.findIndex(d =>
        (d.facing || '').toLowerCase() === 'environment' ||
        /(back|rear|traseir|environment|world|wide)/i.test(d.label)
      );
      targetIdx = iBack >= 0 ? iBack : 0;
    }

    this.currentIdx = targetIdx;
    this.stop();

    const dev = this.working[this.currentIdx];
    const byFacing = dev._byFacing || !this._canUseDeviceId();

    const videoConstraints = byFacing
      ? { facingMode: { ideal: (dev.facing || 'environment') }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } }
      : { deviceId: { exact: dev.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } };

    this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
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

    const isBack = (dev.facing || '').toLowerCase() === 'environment' ||
                   /(back|rear|traseir|environment|world|wide)/i.test(dev.label);
    this.mirrored = !isBack; // espelha apenas frontal
    this.video.classList.toggle('mirror', this.mirrored);

    this.selectLabel.textContent = this._friendlyName(dev, this.currentIdx);
  }

  stop() {
    if (this.stream) {
      try { this.stream.getTracks().forEach(t => t.stop()); } catch {}
      this.stream = null;
      this.video.srcObject = null;
    }
  }
}