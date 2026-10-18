// =============================================================
// ai/index.js — Génération de questions par IA (FACULTATIVE, désactivée par défaut)
// =============================================================
// L'appli fonctionne entièrement sans IA. Si tu l'actives dans les réglages
// avec ta propre clé API, un bouton apparaît sur chaque leçon pour générer
// de meilleurs QCM / QROC / cas cliniques.
//
// Architecture : un "fournisseur" = un petit module avec une fonction generate().
//  - anthropic        → Claude, via le SDK officiel d'Anthropic ;
//  - openaiCompatible → OpenAI, Mistral, et tout service au même format.
// Pour ajouter un fournisseur : écrire un module avec generate(), puis
// l'ajouter dans PROVIDERS ci-dessous.

import * as anthropic from './anthropic.js';
import * as openaiCompatible from './openaiCompatible.js';
import { buildPrompt, normalizeAiQuestions } from './prompt.js';

/** Les fournisseurs proposés dans les réglages. */
export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    module: anthropic,
    defaultModel: anthropic.DEFAULT_MODEL,
    keyHelp: 'Clé sur console.anthropic.com',
  },
  openai: {
    label: 'OpenAI',
    module: openaiCompatible,
    baseUrl: 'https://api.openai.com/v1',
    keyHelp: 'Clé sur platform.openai.com',
  },
  mistral: {
    label: 'Mistral',
    module: openaiCompatible,
    baseUrl: 'https://api.mistral.ai/v1',
    keyHelp: 'Clé sur console.mistral.ai',
  },
  custom: {
    label: 'Autre (compatible OpenAI)',
    module: openaiCompatible,
    customUrl: true, // l'adresse est saisie dans les réglages
    keyHelp: 'OpenRouter, Groq, Ollama en local (http://localhost:11434/v1)…',
  },
};

/** Réglages IA par défaut : désactivée. */
export const DEFAULT_AI_SETTINGS = {
  enabled: false,
  provider: 'anthropic',
  apiKey: '',
  model: '',
  baseUrl: '',
  count: 10, // questions par génération
};

/** L'IA est-elle prête à être utilisée ? */
export function isAiReady(ai) {
  if (!ai?.enabled) return false;
  const provider = PROVIDERS[ai.provider];
  if (!provider) return false;
  if (provider.customUrl) return Boolean(ai.baseUrl && ai.model); // la clé peut être vide (modèle local)
  if (!ai.apiKey) return false;
  return Boolean(ai.model || provider.defaultModel);
}

/**
 * Génère des questions pour une leçon.
 * @returns {Promise<Array>} questions au format de l'appli (kind 'qcm' | 'qroc')
 */
export async function generateQuestionsWithAI(lesson, ai, { subjectName, existingPrompts, fetch } = {}) {
  const provider = PROVIDERS[ai.provider];
  if (!provider) throw new Error('Fournisseur inconnu.');
  const { system, user } = buildPrompt(lesson, { count: ai.count, subjectName, existingPrompts });

  const raw = await provider.module.generate({
    apiKey: ai.apiKey,
    model: ai.model || provider.defaultModel,
    baseUrl: provider.customUrl ? ai.baseUrl : provider.baseUrl,
    system,
    user,
    fetch,
  });

  const questions = normalizeAiQuestions(raw);
  if (!questions.length) throw new Error("L'IA n'a produit aucune question utilisable. Réessaie.");
  return questions;
}

/** Petit essai pour vérifier la clé et le modèle (génère 1 question sur un mini-cours). */
export function testAi(ai, options = {}) {
  const sample = {
    title: 'Test',
    text: 'La tachycardie est une fréquence cardiaque supérieure à 100 battements par minute.',
    highlights: [],
  };
  return generateQuestionsWithAI(sample, { ...ai, count: 1 }, options);
}
