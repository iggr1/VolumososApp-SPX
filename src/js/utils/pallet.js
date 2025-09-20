// helpers/pallets.js

import { apiGet, apiPost } from '../api.js';
import { updateCounts } from './helper.js';
import { showAlert } from './alerts.js';

// ---- pallets --------------------------------------------------------------

export async function getAllPallets() {
    // usa a rota criada no servidor que já retorna pallets com seus packages
    return await apiGet('pallets', { order: 'asc' });
}

export async function clearAllPallets() {
    await apiPost('pallets/clear');
    updateCounts();
}

// ---- local pallet (armazenamento local) -----------------------------------

export function verifyAlreadyInLocalPallet(brCode) {
    const code = String(brCode || '').trim().toUpperCase();
    const current = safeGetLS('currentPallet', []);
    return current.some(item =>
        String(item.brCode || item.brcode || '').toUpperCase() === code
    );
}

export function sendToLocalPallet(packageToAdd) {
    const current = safeGetLS('currentPallet', []);
    current.push(packageToAdd);
    localStorage.setItem('currentPallet', JSON.stringify(current));
    updateCounts();
}

// ---- fila de envio --------------------------------------------------------

const QUEUE_KEY = 'palletQueue';
let processing = false;

/**
 * Enfileira o pallet atual para envio.
 * options:
 *  - targetPallet: number -> se fornecido, envia para ESTE pallet existente
 *  - mode: 'existing' | ''  (se targetPallet > 0, forçamos 'existing')
 */
export function addIntoQueue(options = {}) {
    const packages = safeGetLS('currentPallet', []);
    if (!Array.isArray(packages) || packages.length === 0) return;

    // normaliza minimamente (server também normaliza)
    const norm = packages
        .map(p => ({
            brCode: String(p.brCode || p.brcode || '').trim().toUpperCase(),
            route: String(p.route || '').trim()
        }))
        .filter(p => p.brCode && p.route);

    if (norm.length === 0) return;

    const targetPallet = Number(options.targetPallet || 0) || 0;
    const mode = targetPallet > 0 ? 'existing' : (options.mode || '');

    const palletObj = {
        packages: norm,
        createdAt: new Date().toISOString(),
        targetPallet,
        mode
    };

    const queue = safeGetLS(QUEUE_KEY, []);
    queue.push(palletObj);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    // limpa o pallet local e atualiza contadores imediatamente
    localStorage.removeItem('currentPallet');
    updateCounts();

    processQueue(); // dispara processamento (não bloqueante)
}

async function processQueue() {
    if (processing) return;
    processing = true;

    try {
        let queue = safeGetLS(QUEUE_KEY, []);
        while (queue.length > 0) {
            const current = queue[0];

            // Se veio targetPallet > 0, enviamos para este ID específico (append)
            const targetId = Number(current?.targetPallet || 0) || 0;

            try {
                let palletId = null;
                let res;

                if (targetId > 0) {
                    res = await apiPost('pallet', {
                        mode: 'existing',
                        targetPallet: targetId,
                        append: true,
                        packages: current.packages
                    });
                    palletId = targetId;
                } else {
                    // fluxo antigo: pega próximo disponível e envia como NOVO
                    let palletInfo;
                    try {
                        palletInfo = await apiGet('pallet/available');
                    } catch (err) {
                        console.error('Falha em pallet/available:', err);
                        break; // tenta novamente no próximo trigger
                    }
                    if (!palletInfo || !palletInfo.palletId) {
                        console.warn('Nenhum pallet disponível no momento.');
                        break;
                    }
                    palletId = palletInfo.palletId;

                    res = await apiPost('pallet', {
                        pallet: palletId,
                        packages: current.packages
                    });
                }

                // sucesso => alerta e tira da fila
                showAlert({
                    title: 'Sucesso!',
                    message: `Total de ${current.packages.length} pacotes enviados com sucesso!\nPALLET NÚMERO: ${palletId}`,
                    type: 'success',
                    durationMs: 5000,
                    dismissible: true,
                    collapseDelayMs: 100
                });

                queue.shift();
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            } catch (err) {
                console.error('Erro ao enviar pacotes:', err);
                // opcional: poderia implementar backoff e retry
                break;
            }

            // recarrega referência da fila
            queue = safeGetLS(QUEUE_KEY, []);
        }
    } finally {
        processing = false;
        updateCounts();
    }
}

// ---- utils ----------------------------------------------------------------

function safeGetLS(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : (parsed ?? fallback);
    } catch {
        return fallback;
    }
}

// Deixa disponível no console para testes manuais
window.processQueue = processQueue;
