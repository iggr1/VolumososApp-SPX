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

export function addIntoQueue() {
    const packages = safeGetLS('currentPallet', []);
    if (!Array.isArray(packages) || packages.length === 0) return;

    const palletObj = {
        packages,
        createdAt: new Date().toISOString()
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

            // rota canônica do servidor
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

            try {
                // grava os pacotes no pallet escolhido
                await apiPost('pallet', { pallet: palletInfo.palletId, packages: current.packages });

                // Notifica sucesso sem bloquear o loop
                showAlert({
                    title: 'Sucesso!',
                    message: `Total de ${current.packages.length} pacotes enviados com sucesso!\nPALLET NÚMERO: ${palletInfo.palletId}`,
                    type: 'success',
                    durationMs: 5000,
                    dismissible: true,
                    collapseDelayMs: 100
                });

                // remove o job processado e persiste
                queue.shift();
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            } catch (err) {
                console.error('Erro ao enviar pacotes:', err);
                // opcional: reagendar uma nova tentativa
                // setTimeout(() => { if (!processing) processQueue(); }, 5000);
                break;
            }
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
