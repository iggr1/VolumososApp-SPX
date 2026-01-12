// register.js
import {
  publicRegisterUser,
  normalizeIdentifier,
  saveHubLocal,
  requestEmailVerification
} from "../utils/auth.js";

import { showAlert } from "../utils/alerts.js";
import { enhanceSelect } from "../utils/uiSelect.js";
import { apiGet } from "../api.js";
import { openModal } from "../modal.js";

export const meta = {
  title: "Criar Conta",
  size: "sm",
  showBack: true,
  showClose: false,
  backdropClose: false,
  escToClose: false,
  initialFocus: "#reg-hub",
};

export default function render(_props = {}, api) {
  api.setBackTo("login");

  const hubIndex = new Map();
  const el = document.createElement("div");
  el.className = "register-form";

  el.innerHTML = `
    <!-- HUB SELECT -->
    <div class="register-field">
      <div class="register-label">Operação / HUB</div>
      <div class="login-select-wrap">
        <select id="reg-hub" class="register-input select-hidden" required>
          <option value="" selected disabled>Selecione uma opção</option>
        </select>

        <div class="ui-select" data-for="reg-hub" aria-expanded="false">
          <button type="button" class="ui-select-btn" aria-haspopup="listbox">
            <span class="label">Selecione uma opção</span>
          </button>
          <ul class="ui-select-list" role="listbox"></ul>
        </div>
      </div>
    </div>

    <!-- EMAIL -->
    <div class="register-field">
      <div class="register-label">E-mail corporativo</div>
      <input id="reg-user" class="register-input" type="text" 
             placeholder="ex: nome@shopee.com" required />
      <div class="register-hint">
        Apenas e-mails @shopee.com / @shopeemobile-external.com
      </div>
    </div>

    <!-- SENHA -->
    <div class="register-field">
      <div class="register-label">Senha</div>
      <div class="register-input-row">
        <input id="reg-pass" class="register-input" type="password" placeholder="Crie uma senha" required />
        <button type="button" class="register-eye-btn" id="toggle-pass-main">
          <i data-lucide="eye"></i>
        </button>
      </div>
    </div>

    <!-- CONFIRM PASSWORD -->
    <div class="register-field">
      <div class="register-label">Repita a senha</div>
      <div class="register-input-row">
        <input id="reg-pass-confirm" class="register-input" type="password" placeholder="Repita a senha" required />
        <button type="button" class="register-eye-btn" id="toggle-pass-confirm">
          <i data-lucide="eye"></i>
        </button>
      </div>
    </div>

    <!-- EMAIL CODE -->
    <div class="register-field" id="email-code-field" hidden>
      <div class="register-label">Código de verificação</div>
      <div class="register-input-row">
        <input id="reg-email-code" class="register-input" 
               type="text" inputmode="numeric" maxlength="6"
               placeholder="Código enviado ao e-mail" />
        <button type="button" class="register-btn register-btn--ghost" id="reg-resend-code">
          <i data-lucide="refresh-cw"></i>
        </button>
      </div>
    </div>

    <!-- AÇÕES -->
    <div class="register-actions">
      <button type="button" class="register-btn register-btn--orange" id="reg-submit">
        <i data-lucide="user-plus"></i>
        <span>Criar Conta</span>
      </button>
    </div>
  `;

  try { window.lucide?.createIcons?.(); } catch {}

  // -------------------------------------------------------------------
  // REFERÊNCIAS
  // -------------------------------------------------------------------
  const identInput = el.querySelector("#reg-user");
  const submitButton = el.querySelector("#reg-submit");
  const emailCodeField = el.querySelector("#email-code-field");
  const emailCodeInput = el.querySelector("#reg-email-code");
  const resendCodeBtn = el.querySelector("#reg-resend-code");
  const passInput = el.querySelector("#reg-pass");
  const passConfirmInput = el.querySelector("#reg-pass-confirm");
  const togglePassBtn = el.querySelector("#toggle-pass-main");
  const togglePassConfirmBtn = el.querySelector("#toggle-pass-confirm");

  let lastEmailIdent = null;
  let awaitingCode = false;

  // -------------------------------------------------------------------
  // LOADING STATE
  // -------------------------------------------------------------------
  function setLoading(isLoading) {
    submitButton.classList.toggle("register-btn--loading", isLoading);
    document.querySelector(".modal")?.classList?.toggle("loading", isLoading);
  }

  // -------------------------------------------------------------------
  // EYE TOGGLES (SENHAS)
  // -------------------------------------------------------------------
  function swapIcon(btn, name) {
    if (window.lucide?.icons?.[name]?.toSvg) {
      btn.innerHTML = window.lucide.icons[name].toSvg({ "aria-hidden": "true" });
    } else {
      let i = btn.querySelector("[data-lucide]") || document.createElement("i");
      i.setAttribute("aria-hidden", "true");
      i.setAttribute("data-lucide", name);
      btn.innerHTML = "";
      btn.appendChild(i);
      try { window.lucide?.createIcons?.(); } catch {}
    }
  }

  function setupToggle({ input, btn, labelShow, labelHide }) {
    if (!input || !btn) return;

    function setVisible(show) {
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? labelHide : labelShow);
      swapIcon(btn, show ? "eye-off" : "eye");
    }

    let lastSelection = null;

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      lastSelection = {
        start: input.selectionStart,
        end: input.selectionEnd,
        dir: input.selectionDirection,
      };
    });

    btn.addEventListener("click", () => {
      const willShow = input.type === "password";
      setVisible(willShow);

      const s = lastSelection?.start ?? input.value.length;
      const e = lastSelection?.end ?? s;
      requestAnimationFrame(() => {
        try { input.setSelectionRange(s, e, lastSelection?.dir || "none"); } catch {}
      });
    });

    setVisible(false);
  }

  setupToggle({
    input: passInput,
    btn: togglePassBtn,
    labelShow: "Mostrar senha",
    labelHide: "Ocultar senha",
  });

  setupToggle({
    input: passConfirmInput,
    btn: togglePassConfirmBtn,
    labelShow: "Mostrar senha",
    labelHide: "Ocultar senha",
  });

  // -------------------------------------------------------------------
  // VALIDAR CAMPOS
  // -------------------------------------------------------------------
  function validateInputs() {
    const hubCode = el.querySelector("#reg-hub").value;
    const rawEmail = identInput.value.trim();
    const pass = el.querySelector("#reg-pass").value;
    const pass2 = el.querySelector("#reg-pass-confirm").value;

    if (!hubCode || !rawEmail || !pass || !pass2) {
      showAlert({
        type: "error",
        title: "Campos incompletos",
        message: "Preencha todos os campos obrigatórios.",
      });
      return null;
    }

    if (pass.length < 6) {
      showAlert({
        type: "error",
        title: "Senha muito curta",
        message: "A senha deve ter ao menos 6 caracteres.",
      });
      return null;
    }

    if (pass !== pass2) {
      showAlert({
        type: "error",
        title: "Senhas não conferem",
        message: "As senhas são diferentes.",
      });
      return null;
    }

    const norm = normalizeIdentifier(rawEmail);
    if (!norm.ok) {
      showAlert({
        type: "error",
        title: "E-mail inválido",
        message: norm.error,
      });
      return null;
    }

    const hub = hubIndex.get(hubCode);
    if (!hub) {
      showAlert({
        type: "error",
        title: "HUB inválido",
        message: "Selecione um HUB válido.",
      });
      return null;
    }

    lastEmailIdent = norm.ident;

    return { email: norm.ident, pass, hub };
  }

  // -------------------------------------------------------------------
  // SUBMIT
  // -------------------------------------------------------------------
  async function onSubmit() {
    const info = validateInputs();
    if (!info) return;

    const { email, pass, hub } = info;

    setLoading(true);

    // --- FASE 1: enviar código ---
    if (!awaitingCode) {
      const res = await requestEmailVerification(email);

      if (!res?.ok) {
        showAlert({
          type: "error",
          title: "Erro",
          message: res?.error || "Falha ao enviar código.",
        });
        return setLoading(false);
      }

      awaitingCode = true;
      emailCodeField.hidden = false;
      submitButton.querySelector("span").textContent = "Confirmar código";

      showAlert({
        type: "info",
        title: "Código enviado",
        message: `Um código foi enviado para ${email}`,
      });

      return setLoading(false);
    }

    // --- FASE 2: validar código e registrar ---
    const code = emailCodeInput.value.trim();
    if (!code) {
      showAlert({
        type: "error",
        title: "Código obrigatório",
        message: "Digite o código enviado ao seu e-mail.",
      });
      return setLoading(false);
    }

    const data = await publicRegisterUser({
      username: email,
      password: pass,
      email_code: code,
      hub: hub.code, // agora o backend recebe o hub correto
    });

    if (!data?.ok) {
      showAlert({
        type: "error",
        title: "Falha ao criar conta",
        message: data?.error || "Erro desconhecido.",
      });
      return setLoading(false);
    }

    const isPending = String(data.status || '').toLowerCase() === 'pending';

    saveHubLocal(hub);
    setLoading(false);

    await showAlert({
      type: isPending ? 'warning' : 'success',
      title: isPending ? 'Cadastro enviado' : 'Conta criada!',
      message: isPending
        ? 'Seu usuário ficou pendente. Peça a liberação com sua liderança/analista e depois faça login.'
        : 'Conta criada com sucesso. Agora faça login.',
      durationMs: 4000
    });

    // ✅ troca o modal atual pelo login (sem depender do openModal importado)
    api.swap('login', { prefHub: hub.code, prefUser: email });
    return;
  }

  submitButton.onclick = onSubmit;

  // -------------------------------------------------------------------
  // HUB SELECT — agora via backend
  // -------------------------------------------------------------------
  const niceSelect = enhanceSelect(el, "reg-hub");

  initHubs();

  async function initHubs() {
    const data = await apiGet("hubs");
    if (!data?.ok || !Array.isArray(data.hubs)) {
      return showAlert({
        type: "error",
        title: "Erro",
        message: "Falha ao carregar lista de HUBs.",
      });
    }

    buildHubIndex(data.hubs);
    populateSelect(data.hubs);

    const saved = localStorage.getItem("hubCode");
    if (saved && hubIndex.has(saved)) {
      el.querySelector("#reg-hub").value = saved;
      niceSelect.pick(saved, hubIndex.get(saved).label);
    }
  }

  function buildHubIndex(list) {
    hubIndex.clear();
    for (const h of list) {
      const code = String(h.code).trim();
      const label = h.label || h.name || code;
      hubIndex.set(code, { code, label });
    }
  }

  function populateSelect(list) {
    const sel = el.querySelector("#reg-hub");

    sel.innerHTML =
      `<option value="" selected disabled>Selecione uma opção</option>` +
      list
        .map((h) => `<option value="${h.code}">${h.label}</option>`)
        .join("");

    niceSelect.refreshOptions();
  }

  return el;
}
