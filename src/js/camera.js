export class CameraController {
  /**
   * @param {{ camEl:HTMLElement, selectBtn:HTMLElement, flipBtn:HTMLElement, selectLabel:HTMLElement }} deps
   */
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
    this.currentIdx = 0;
    this.stream = null;
    this.mirrored = false;

    this._scanner = null; // QrScanner opcional plugado

    this.bindUI();
  }

  getVideo() {
    return this.video;
  }

  /**
   * Pluga uma instância de QrScanner para ser reiniciada em toda troca de câmera.
   */
  attachScanner(scanner) {
    this._scanner = scanner || null;
    return this;
  }

  bindUI() {
    if (this.selectBtn) {
      this.selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selector.classList.contains('show')
          ? this.hideSelector()
          : this.showSelector();
      });
    }

    document.addEventListener('click', () => this.hideSelector());

    if (this.flipBtn) {
      this.flipBtn.addEventListener('click', () => {
        this.mirrored = !this.mirrored;
        this.video.classList.toggle('mirror', this.mirrored);
      });
    }
  }

  // ---------- ENUMERATE ----------
  async enumerate() {
    let all = await navigator.mediaDevices.enumerateDevices();
    this.allDevices = all.filter((d) => d.kind === 'videoinput');

    if (!this.allDevices.length) {
      throw new Error('Nenhuma câmera disponível');
    }

    // desbloqueia labels se necessario
    const hasLabels = this.allDevices.some((d) => d.label && d.label.trim());
    if (!hasLabels) {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach((t) => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
        this.allDevices = all.filter((d) => d.kind === 'videoinput');
      } catch {
        // se falhar, segue com o que tiver
      }
    }

    if (!this.allDevices.length) {
      throw new Error('Nenhuma câmera detectada');
    }
  }

  // ---------- SELECTOR UI ----------
  buildSelector() {
    this.selector.innerHTML = '';

    this.allDevices.forEach((d, i) => {
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

  async showSelector() {
    if (!this.allDevices.length) {
      await this.enumerate();
    }
    this.buildSelector();
    this.selector.classList.add('show');
  }

  hideSelector() {
    this.selector.classList.remove('show');
  }

  // ---------- START / STOP ----------
  /**
   * Abre a câmera pelo índice e reinicia o QrScanner (se houver).
   */
  async start(index = 0) {
    if (!this.allDevices.length) {
      await this.enumerate();
    }

    this.currentIdx = Math.max(0, Math.min(index, this.allDevices.length - 1));
    const dev = this.allDevices[this.currentIdx];

    // para stream anterior
    this.stop();

    // tenta por deviceId; se falhar, cai pra generico
    const constraints = dev.deviceId
      ? {
          video: {
            deviceId: { exact: dev.deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
        }
      : { video: true };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    this.stream = stream;
    this.video.srcObject = stream;

    // garante que o video está pronto
    await new Promise((resolve) => {
      if (this.video.readyState >= 2 && !this.video.paused) return resolve();
      const onMeta = () => {
        this.video.removeEventListener('loadedmetadata', onMeta);
        resolve();
      };
      this.video.addEventListener('loadedmetadata', onMeta, { once: true });
    });

    await this.video.play().catch(() => {});

    // aplica espelho conforme estado atual (botao flip controla isso)
    this.video.classList.toggle('mirror', this.mirrored);

    // label visível
    if (this.selectLabel) {
      this.selectLabel.textContent = dev.label || `Câmera ${this.currentIdx + 1}`;
    }

    // tenta foco contínuo se o device suportar
    try {
      const [track] = stream.getVideoTracks();
      const caps = track.getCapabilities?.() || {};
      const adv = [];
      if (caps.focusMode?.includes?.('continuous')) adv.push({ focusMode: 'continuous' });
      if (typeof caps.focusDistance?.max === 'number') adv.push({ focusDistance: caps.focusDistance.max });
      if (adv.length) await track.applyConstraints({ advanced: adv });
    } catch {
      // ignora se não suportar
    }

    // 🔁 reinicia scanner com a nova stream
    if (this._scanner) {
      try {
        this._scanner.stop();
      } catch {}
      // pequeno yield pra garantir que o srcObject já apontou pra nova stream
      await Promise.resolve();
      this._scanner.start();
    }
  }

  stop() {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }
}
