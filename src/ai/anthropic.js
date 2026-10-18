// =============================================================
// ai/anthropic.js — Fournisseur "Claude" (Anthropic), via le SDK officiel
// =============================================================
// - Réponse imposée au format JSON (structured outputs : output_config.format),
//   donc pas de mauvaise surprise de format.
// - Pour les modèles qui le permettent, "fallbacks: default" : si le modèle
//   refuse une demande (filtre de sécurité, rare pour du contenu médical mais
//   possible), l'API réessaie automatiquement avec un autre modèle.
//
// Appel direct depuis le téléphone : le SDK l'interdit par défaut
// (dangerouslyAllowBrowser) car, sur un site public, la clé serait visible
// par tous. Ici c'est TA clé, sur TON téléphone, utilisée uniquement par toi :
// c'est donc acceptable. Ne publie jamais une version de l'appli avec une clé intégrée.

import { QUESTIONS_SCHEMA, parseAiJson } from './prompt.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

// Modèles qui acceptent le repli automatique "fallbacks: default".
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

/**
 * Envoie la consigne à Claude et renvoie l'objet JSON produit.
 * @param {object} p — { apiKey, model, system, user, fetch? }
 */
export async function generate({ apiKey, model, system, user, fetch }) {
  // Le SDK n'est chargé que si l'IA est utilisée (l'appli reste légère sinon).
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, ...(fetch ? { fetch } : {}) });
  const chosenModel = model || DEFAULT_MODEL;
  const withFallback = FALLBACK_MODELS.includes(chosenModel);

  let response;
  try {
    response = await client.beta.messages.create({
      model: chosenModel,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: {
        effort: 'medium', // assez pour des questions de qualité, sans surcoût
        format: { type: 'json_schema', schema: QUESTIONS_SCHEMA },
      },
      ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    });
  } catch (error) {
    throw new Error(explainError(error, Anthropic));
  }

  if (response.stop_reason === 'refusal') {
    throw new Error("L'IA a refusé de traiter ce cours. Essaie avec un autre modèle.");
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Réponse trop longue, coupée. Demande moins de questions à la fois.');
  }
  const text = response.content.find((block) => block.type === 'text')?.text;
  return parseAiJson(text);
}

/** Message d'erreur en français selon le type d'erreur renvoyé par le SDK. */
function explainError(error, Anthropic) {
  if (error instanceof Anthropic.AuthenticationError) return 'Clé API refusée. Vérifie-la dans les réglages.';
  if (error instanceof Anthropic.PermissionDeniedError) return "Cette clé n'a pas accès à ce modèle.";
  if (error instanceof Anthropic.NotFoundError) return 'Modèle introuvable. Vérifie son nom dans les réglages.';
  if (error instanceof Anthropic.RateLimitError) return 'Trop de demandes ou crédit épuisé. Réessaie plus tard.';
  if (error instanceof Anthropic.BadRequestError) return `Demande refusée par l'API : ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return 'Pas de connexion à Internet (ou serveur injoignable).';
  if (error instanceof Anthropic.APIError) return `Erreur du service (${error.status ?? '?'}). Réessaie plus tard.`;
  return error?.message || 'Erreur inconnue.';
}
