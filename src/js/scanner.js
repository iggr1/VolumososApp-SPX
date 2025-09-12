export class QrScanner {
  constructor({ video, camEl, scanEl, onResult }) {
    this.video = video;
    this.camEl = camEl;
    this.scanEl = scanEl;
    this.onResult = onResult;
    this.ticking = false;
    this.lastValue = '';
    this.lastTick = 0;

    this.off = document.createElement('canvas');
    this.ctx = this.off.getContext('2d', { willReadFrequently: true });
    this.off.width = 640; this.off.height = 640;

    this.detector = null;
    this.mode = 'none';
  }

  async ensureDetector() {
    if (this.detector) return this.mode;
    if ('BarcodeDetector' in window) {
      this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      this.mode = 'native';
    } else {
      const { BrowserQRCodeReader } = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm');
      this.detector = new BrowserQRCodeReader();
      this.mode = 'zxing';
    }
    return this.mode;
  }

  getCropRect() {
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;

    const camR = this.camEl.getBoundingClientRect();
    const scanR = this.scanEl.getBoundingClientRect();

    const scale = Math.max(camR.width / vw, camR.height / vh);
    const dispW = vw * scale, dispH = vh * scale;
    const offX = (camR.width - dispW) / 2, offY = (camR.height - dispH) / 2;

    const relLeft = (scanR.left - camR.left - offX);
    const relTop = (scanR.top - camR.top - offY);

    let sx = relLeft / dispW * vw;
    let sy = relTop / dispH * vh;
    let sw = scanR.width / dispW * vw;
    let sh = scanR.height / dispH * vh;

    sx = Math.max(0, Math.min(vw - 1, sx));
    sy = Math.max(0, Math.min(vh - 1, sy));
    sw = Math.max(1, Math.min(vw - sx, sw));
    sh = Math.max(1, Math.min(vh - sy, sh));
    return { sx, sy, sw, sh };
  }

  async start() {
    if (this.ticking) return;
    this.ticking = true;
    await this.ensureDetector();

    const loop = async (tNow) => {
      if (!this.ticking || !this.video.srcObject) return;

      try {
        if (!this.lastTick || (tNow - this.lastTick) > 120) {
          this.lastTick = tNow;
          const { sx, sy, sw, sh } = this.getCropRect();

          if (this.mode === 'native') {
            const bmp = await createImageBitmap(this.video, sx, sy, sw, sh);
            const codes = await this.detector.detect(bmp);
            bmp.close?.();
            const val = codes?.[0]?.rawValue || codes?.[0]?.rawValueText || null;
            if (val && val !== this.lastValue) {
              this.lastValue = val;
              this.onResult?.(val);
            }
          } else {
            this.off.width = Math.min(800, Math.max(320, Math.round(sh)));
            this.off.height = this.off.width;

            this.ctx.clearRect(0, 0, this.off.width, this.off.height);
            const scale = Math.max(this.off.width / sw, this.off.height / sh);
            const dw = sw * scale, dh = sh * scale;
            const dx = (this.off.width - dw) / 2, dy = (this.off.height - dh) / 2;
            this.ctx.drawImage(this.video, sx, sy, sw, sh, dx, dy, dw, dh);

            const res = await this.detector.decodeFromCanvas(this.off).catch(() => null);
            const val = res?.getText?.();
            if (val && val !== this.lastValue) {
              this.lastValue = val;
              this.onResult?.(val);
            }
          }
        }
      } catch { }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.ticking = false; }
}
