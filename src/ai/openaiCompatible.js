// =============================================================
// ai/openaiCompatible.js — Fournisseurs au format "compatible OpenAI"
// =============================================================
// Beaucoup de services utilisent le même format d'API que OpenAI :
// OpenAI lui-même, Mistral, OpenRouter, Groq, ou un modèle local avec Ollama…
// Il suffit de changer l'adresse (baseUrl), la clé et le nom du modèle.
//
// On demande une réponse JSON (response_format: json_object) ; selon le service,
// le format n'est pas toujours garanti, d'où la vérification dans prompt.js.

import { parseAiJson } from './prompt.js';

/**
 * Envoie la consigne et renvoie l'objet JSON produit.
 * @param {object} p — { apiKey, model, baseUrl, system, user, fetch? }
 */
export async function generate({ apiKey, model, baseUrl, system, user, fetch = globalThis.fetch }) {
  if (!baseUrl) throw new Error("Indique l'adresse de l'API dans les réglages.");
  if (!model) throw new Error('Indique le nom du modèle dans les réglages.');

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), // un modèle local n'a pas besoin de clé
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    throw new Error("Impossible de joindre le service (pas de connexion, ou adresse incorrecte / qui refuse les appels depuis un navigateur).");
  }

  if (!res.ok) throw new Error(explainStatus(res.status, await safeText(res)));

  const data = await res.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Réponse trop longue, coupée. Demande moins de questions à la fois.');
  }
  return parseAiJson(choice?.message?.content);
}

function explainStatus(status, detail) {
  if (status === 401) return 'Clé API refusée. Vérifie-la dans les réglages.';
  if (status === 403) return "Cette clé n'a pas accès à ce modèle.";
  if (status === 404) return "Modèle ou adresse introuvable. Vérifie les réglages.";
  if (status === 429) return 'Trop de demandes ou crédit épuisé. Réessaie plus tard.';
  if (status >= 500) return `Erreur du service (${status}). Réessaie plus tard.`;
  return `Demande refusée (${status})${detail ? ` : ${detail.slice(0, 200)}` : ''}`;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
