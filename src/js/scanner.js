export class QrScanner {
  constructor({ video, camEl, scanEl, onResult }) {
    this.video = video;
    this.camEl = camEl;
    this.scanEl = scanEl;
    this.onResult = onResult;

    this.ticking = false;
    this.lastTick = 0;

    // dedupe com TTL
    this.lastValue = '';
    this.lastValueAt = 0;
    this.lastValueTTL = 5000;
    this.lastValueTimer = null;

    // desenho
    this.off = document.createElement('canvas');
    this.ctx = this.off.getContext('2d', { willReadFrequently: true });
    this.off.width = 640;
    this.off.height = 640;

    // detector & captura
    this.detector = null;
    this.mode = 'none'; // 'native' | 'zxing'
    this._busy = false; // evita decodes concorrentes
    this._capture = null; // ImageCapture
    this._trackId = null; // para detectar troca de track
  }

  setTTL(ms) {
    this.lastValueTTL = Math.max(0, +ms || 0);
  }

  clearLastValue() {
    this.lastValue = '';
    this.lastValueAt = 0;
    if (this.lastValueTimer) {
      clearTimeout(this.lastValueTimer);
      this.lastValueTimer = null;
    }
  }

  _remember(val, tNow) {
    if (val === this.lastValue && tNow - this.lastValueAt < this.lastValueTTL) return false;
    this.lastValue = val;
    this.lastValueAt = tNow;
    if (this.lastValueTimer) clearTimeout(this.lastValueTimer);
    this.lastValueTimer = setTimeout(() => this.clearLastValue(), this.lastValueTTL);
    return true;
  }

  async ensureDetector(force = false) {
    if (force) this.detector = null;
    if (this.detector) return this.mode;
    if ('BarcodeDetector' in window) {
      this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      this.mode = 'native';
    } else {
      const { BrowserQRCodeReader } =
        await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm');
      this.detector = new BrowserQRCodeReader();
      this.mode = 'zxing';
    }
    return this.mode;
  }

  _ensureCaptureForCurrentTrack() {
    const stream = this.video.srcObject;
    const track = stream?.getVideoTracks?.()[0] || null;
    const id = track?.id || null;

    // se trocou o track, recria o ImageCapture
    if (id && id !== this._trackId) {
      this._trackId = id;
      this._capture = window.ImageCapture && track ? new ImageCapture(track) : null;
    }
  }

  getCropRect() {
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;

    const camR = this.camEl.getBoundingClientRect();
    const scanR = this.scanEl.getBoundingClientRect();

    const scale = Math.max(camR.width / vw, camR.height / vh);
    const dispW = vw * scale,
      dispH = vh * scale;
    const offX = (camR.width - dispW) / 2,
      offY = (camR.height - dispH) / 2;

    const relLeft = scanR.left - camR.left - offX;
    const relTop = scanR.top - camR.top - offY;

    let sx = (relLeft / dispW) * vw;
    let sy = (relTop / dispH) * vh;
    let sw = (scanR.width / dispW) * vw;
    let sh = (scanR.height / dispH) * vh;

    sx = Math.max(0, Math.min(vw - 1, sx));
    sy = Math.max(0, Math.min(vh - 1, sy));
    sw = Math.max(1, Math.min(vw - sx, sw));
    sh = Math.max(1, Math.min(vh - sy, sh));
    return { sx, sy, sw, sh };
  }

  async _grabBitmap({ sx, sy, sw, sh }) {
    // 1) preferir ImageCapture (ligado ao track atual)
    this._ensureCaptureForCurrentTrack();
    if (this._capture?.grabFrame) {
      try {
        const frame = await this._capture.grabFrame();
        // recorta usando canvas para gerar bitmap final
        this.off.width = Math.min(800, Math.max(320, Math.round(sh)));
        this.off.height = this.off.width;
        const scale = Math.max(this.off.width / sw, this.off.height / sh);
        const dw = sw * scale,
          dh = sh * scale;
        const dx = (this.off.width - dw) / 2,
          dy = (this.off.height - dh) / 2;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.off.width, this.off.height);
        ctx.drawImage(frame, sx, sy, sw, sh, dx, dy, dw, dh);

        return await createImageBitmap(this.off);
      } catch {
        /* cai pro fallback abaixo */
      }
    }

    // 2) fallback: recorta do <video> via canvas
    this.off.width = Math.min(800, Math.max(320, Math.round(sh)));
    this.off.height = this.off.width;
    const scale = Math.max(this.off.width / sw, this.off.height / sh);
    const dw = sw * scale,
      dh = sh * scale;
    const dx = (this.off.width - dw) / 2,
      dy = (this.off.height - dh) / 2;
    this.ctx.clearRect(0, 0, this.off.width, this.off.height);
    this.ctx.drawImage(this.video, sx, sy, sw, sh, dx, dy, dw, dh);

    try {
      return await createImageBitmap(this.off);
    } catch {
      // se nem createImageBitmap existir, o ZXing usa o próprio canvas
      return null;
    }
  }

  async start() {
    await this.ensureDetector();
    this.stop(); // limpa loop anterior
    this._trackId = null; // força recriar ImageCapture no primeiro frame
    this._busy = false;
    this.ticking = true;
    this.lastTick = 0;

    const loop = async tNow => {
      if (!this.ticking) return;

      const stream = this.video.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!stream || !track || track.readyState === 'ended' || !stream.active) {
        this.ticking = false;
        return;
      }
      if (this.video.readyState < 2) {
        // HAVE_CURRENT_DATA
        return requestAnimationFrame(loop);
      }

      try {
        if (!this._busy && (!this.lastTick || tNow - this.lastTick > 120)) {
          this._busy = true;
          this.lastTick = tNow;

          const { sx, sy, sw, sh } = this.getCropRect();

          if (this.mode === 'native') {
            const bmp = await this._grabBitmap({ sx, sy, sw, sh });
            if (bmp) {
              const codes = await this.detector.detect(bmp);
              bmp.close?.();
              const val = codes?.[0]?.rawValue || codes?.[0]?.rawValueText || null;
              if (val && this._remember(val, tNow)) this.onResult?.(val);
            } else {
              // se não deu bitmap, tenta detectar direto do <video>
              const altBmp = await createImageBitmap(this.video).catch(() => null);
              if (altBmp) {
                const codes = await this.detector.detect(altBmp);
                altBmp.close?.();
                const val = codes?.[0]?.rawValue || codes?.[0]?.rawValueText || null;
                if (val && this._remember(val, tNow)) this.onResult?.(val);
              }
            }
          } else {
            // ZXing: decodifica do canvas (já desenhado em _grabBitmap fallback)
            // garante que canvas está atualizado
            this.off.width = Math.min(800, Math.max(320, Math.round(sh)));
            this.off.height = this.off.width;
            const scale = Math.max(this.off.width / sw, this.off.height / sh);
            const dw = sw * scale,
              dh = sh * scale;
            const dx = (this.off.width - dw) / 2,
              dy = (this.off.height - dh) / 2;
            this.ctx.clearRect(0, 0, this.off.width, this.off.height);
            this.ctx.drawImage(this.video, sx, sy, sw, sh, dx, dy, dw, dh);

            const res = await this.detector.decodeFromCanvas(this.off).catch(() => null);
            const val = res?.getText?.();
            if (val && this._remember(val, tNow)) this.onResult?.(val);
          }
        }
      } catch {
        // ignora erros de frame
      } finally {
        this._busy = false;
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  stop() {
    this.ticking = false;
    this._busy = false;
    this._trackId = null;
    this._capture = null;
    this.clearLastValue();
  }
}
