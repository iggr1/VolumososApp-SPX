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

    this.allDevices = [];   // enumerateDevices (videoinput)
    this.working = [];      // entradas efetivas que abrem: { deviceId, label, facing, _byFacing? }
    this.extra = [];        // “Outras detectadas” (deviceId distintos) que abrem
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
    this.allDevices = all.filter(d => d.kind === 'videoinput');
    if (!this.allDevices.length) throw new Error('Sem câmera disponível');

    // desbloqueia labels se necessário
    const hasLabels = this.allDevices.some(d => d.label && d.label.trim());
    if (!hasLabels) {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach(t => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
        this.allDevices = all.filter(d => d.kind === 'videoinput');
      } catch { }
    }

    await this._discoverAllThatOpen();
  }

  // ======== Helpers de plataforma ========
  _isAppleLike() {
    const ua = navigator.userAgent || '';
    return /(iPhone|iPad|iPod)/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  }
  _canUseDeviceId() {
    const ids = this.allDevices.map(d => d.deviceId).filter(Boolean);
    return !this._isAppleLike() && new Set(ids).size > 1;
  }

  // ======== Descoberta: virtuais (facing) + todas por deviceId ========
  async _discoverAllThatOpen() {
    this.working = [];
    this.extra = [];

    // 1) Sempre tenta garantir entradas “virtuais” por facing (funciona no iOS)
    const env = await this._testOpen(null, false, 'environment');
    if (env) this._pushUnique(this.working, env);

    const usr = await this._testOpen(null, false, 'user');
    if (usr) this._pushUnique(this.working, usr);

    // 2) Se possível, teste TODAS as câmeras por deviceId e liste-as como “Outras detectadas”
    const canById = this._canUseDeviceId();
    if (canById) {
      // heurística: traseiras primeiro, depois neutras, depois o resto
      const looksBack = (s) => /(back|rear|traseir|environment|world|wide)/i.test(String(s || ''));
      const looksFront = (s) => /(front|user|frontal|face|selfie)/i.test(String(s || ''));

      const envFirst = this.allDevices.filter(d => looksBack(d.label));
      const notFront = this.allDevices.filter(d => !looksBack(d.label) && !looksFront(d.label));
      const theRest = this.allDevices.filter(d => !envFirst.includes(d) && !notFront.includes(d));
      const ordered = [...envFirst, ...notFront, ...theRest];

      for (const dev of ordered) {
        if (!dev.deviceId) continue;
        const ok = await this._testOpen(dev.deviceId);
        if (!ok) continue;

        // Se já existe entrada equivalente nas “virtuais”, não repete; senão entra como "extra"
        if (!this._existsSimilar(this.working, ok)) this._pushUnique(this.extra, ok);
      }
    }

    // 3) Último recurso: genérico
    if (this.working.length === 0 && this.extra.length === 0) {
      const any = await this._testOpen(null, true);
      if (any) this._pushUnique(this.working, any);
    }

    if (this.working.length === 0 && this.extra.length === 0) {
      throw new Error('Nenhuma câmera funcional foi encontrada');
    }
  }

  _pushUnique(arr, entry) {
    const key = `${entry.deviceId || ''}|${entry.facing || ''}|${entry.label || ''}`;
    const has = arr.some(e => (`${e.deviceId || ''}|${e.facing || ''}|${e.label || ''}`) === key);
    if (!has) arr.push(entry);
  }
  _existsSimilar(arr, entry) {
    // considera “similar” se o facing coincide ou o label sugere a mesma câmera (evita duplicar frontal/traseira)
    const s = (v = '') => String(v).toLowerCase();
    return arr.some(e =>
      s(e.facing) && s(e.facing) === s(entry.facing) ||
      /(front|user|frontal|face|selfie)/i.test(s(e.label)) && /(front|user|frontal|face|selfie)/i.test(s(entry.label)) ||
      /(back|rear|traseir|environment|world|wide)/i.test(s(e.label)) && /(back|rear|traseir|environment|world|wide)/i.test(s(entry.label))
    );
  }

  async _testOpen(deviceId, generic = false, mode = null) {
    let constraints;
    if (mode) {
      constraints = { video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } } };
    } else if (generic) {
      constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } };
    } else {
      constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      };
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: constraints.video });
      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings?.() || {};
      const usedId = settings.deviceId || deviceId || '';
      const facing = (mode || settings.facingMode || this._guessFacingByLabel(this._labelOf(usedId)) || '').toLowerCase();
      const label = mode === 'environment' ? 'Traseira'
        : mode === 'user' ? 'Frontal'
          : (this._labelOf(usedId) || 'Câmera');
      return { deviceId: usedId, label, facing, _byFacing: Boolean(mode) };
    } catch {
      return null;
    } finally {
      try { stream?.getTracks?.().forEach(t => t.stop()); } catch { }
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

  // ======== UI do seletor (com grupo “Outras detectadas”) ========
  buildSelector() {
    this.selector.innerHTML = '';

    const addSection = (title) => {
      const li = document.createElement('li');
      li.className = 'section';
      li.textContent = title;
      this.selector.appendChild(li);
    };
    const addItem = (d, i, source = 'primary') => {
      const li = document.createElement('li');
      li.textContent = this._friendlyName(d, i, source);
      if (source === 'primary' && i === this.currentIdx) li.classList.add('active');
      li.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (source === 'primary') {
          await this.start(i, { preferBack: false });
        } else {
          // “extra” é uma lista à parte: abra diretamente o device selecionado
          this.stop();
          const byFacing = d._byFacing || !this._canUseDeviceId();
          const videoConstraints = byFacing
            ? { facingMode: { ideal: (d.facing || 'environment') }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } }
            : { deviceId: { exact: d.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } };
          this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
          this.video.srcObject = this.stream;
          await this.video.play();

          const isBack = (d.facing || '').toLowerCase() === 'environment' ||
            /(back|rear|traseir|environment|world|wide)/i.test(d.label);
          this.mirrored = !isBack;
          this.video.classList.toggle('mirror', this.mirrored);
          this.selectLabel.textContent = this._friendlyName(d, -1, 'extra');
        }
        this.hideSelector();
      });
      this.selector.appendChild(li);
    };

    if (this.working.length) {
      addSection('Câmeras principais');
      this.working.forEach((d, i) => addItem(d, i, 'primary'));
    }

    if (this.extra.length) {
      addSection('Outras detectadas');
      this.extra.forEach((d, i) => addItem(d, i, 'extra'));
    }
  }
  showSelector() { this.buildSelector(); this.selector.classList.add('show'); }
  hideSelector() { this.selector.classList.remove('show'); }

  _friendlyName(d, idx, source = 'primary') {
    const base =
      ((d.facing || '').toLowerCase() === 'environment' || /(back|rear|traseir|environment|world|wide)/i.test(d.label)) ? 'Traseira' :
        ((d.facing || '').toLowerCase() === 'user' || /(front|user|frontal|face|selfie)/i.test(d.label)) ? 'Frontal' :
          `Câmera ${idx >= 0 ? (idx + 1) : ''}`.trim();

    if (source === 'extra') {
      // mostra label se existir pra diferenciar
      const label = d.label && !/(frontal|traseira|front|user|back|rear|environment)/i.test(d.label) ? ` — ${d.label}` : '';
      return `${base}${label}`;
    }
    return base;
  }

  // ======== Abertura efetiva ========
  async start(index = undefined, { preferBack = true } = {}) {
    if (!this.working.length && !this.extra.length) await this.enumerate();

    // prioriza as “principais”
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
    } catch { }

    const isBack = (dev.facing || '').toLowerCase() === 'environment' ||
      /(back|rear|traseir|environment|world|wide)/i.test(dev.label);
    this.mirrored = !isBack;
    this.video.classList.toggle('mirror', this.mirrored);

    this.selectLabel.textContent = this._friendlyName(dev, this.currentIdx, 'primary');
  }

  stop() {
    if (this.stream) {
      try { this.stream.getTracks().forEach(t => t.stop()); } catch { }
      this.stream = null;
      this.video.srcObject = null;
    }
  }
}
