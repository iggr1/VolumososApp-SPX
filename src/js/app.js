import { apiGet } from './api.js';

export const $ = (s, r = document) => r.querySelector(s);

export function setupTypography() {
  const root = document.documentElement;
  const initial = parseFloat(getComputedStyle(root).fontSize);

  const x = $('.wrap-x');
  const y = $('.wrap-y');

  // 👇 Defina o "formato mobile" que você quer manter
  // opções comuns:
  // 9/16 (celulares mais antigos)
  // 10/19.5 (bem comum hoje)
  // 3/5 (seu 1.5/2 é igual a 3/4, então cuidado)
  const MOBILE_W = 9;
  const MOBILE_H = 16;

  // trava o aspecto do "telefone"
  const ratio = `${MOBILE_W} / ${MOBILE_H}`;
  if (x) x.style.aspectRatio = ratio;
  if (y) y.style.aspectRatio = ratio;

  function update() {
    // escala baseada no tamanho do "frame" (wrap-y), não na janela
    const wrapY = y || $('.wrap-y');
    if (!wrapY) return;

    // referência: altura ideal do "design" (viewport mobile base)
    // use 812 (iPhone X), 780, 844 etc. Escolha o seu "layout base".
    const DESIGN_H = 812;

    const pct = wrapY.offsetHeight / DESIGN_H;
    root.style.setProperty('--font-size', `${initial * pct}px`);
  }

  addEventListener('resize', update, { passive: true });
  update();
}
