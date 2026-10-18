// Tests de la génération par IA — sans vrai appel réseau :
// on remplace "fetch" par une fausse fonction qui renvoie une réponse préparée.
import { describe, it, expect } from 'vitest';
import { buildPrompt, normalizeAiQuestions, parseAiJson } from '../src/ai/prompt.js';
import { generateQuestionsWithAI, isAiReady, DEFAULT_AI_SETTINGS } from '../src/ai/index.js';

const LESSON = { title: 'Insuffisance cardiaque', text: "L'orthopnée est une dyspnée en position couchée.", highlights: ['BNP élevé'] };
const AI_OUTPUT = {
  questions: [
    {
      kind: 'qcm', context: 'Homme de 70 ans essoufflé la nuit.', prompt: 'Quel signe ?', answer: '',
      options: [{ text: 'Orthopnée', correct: true }, { text: 'Bradycardie', correct: false }],
      explanation: "L'orthopnée traduit la congestion pulmonaire.",
    },
    { kind: 'qroc', context: '', prompt: "Définis l'orthopnée.", answer: 'Dyspnée en position couchée.', options: [], explanation: '' },
    { kind: 'qcm', context: '', prompt: 'QCM sans bonne réponse', answer: '', options: [{ text: 'A', correct: false }, { text: 'B', correct: false }], explanation: '' },
    { kind: 'qroc', context: '', prompt: '', answer: 'sans question', options: [], explanation: '' },
  ],
};

/** Faux "fetch" qui enregistre la requête et renvoie `body` en JSON. */
function fakeFetch(body, status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}

describe('prompt', () => {
  it('inclut le cours, les surlignages et les questions existantes', () => {
    const { system, user } = buildPrompt(LESSON, { count: 7, subjectName: 'Cardio', existingPrompts: ['Définis : BNP'] });
    expect(system).toMatch(/JSON/);
    expect(user).toContain('Écris 7 questions');
    expect(user).toContain(LESSON.text);
    expect(user).toContain('- BNP élevé');
    expect(user).toContain('- Définis : BNP');
  });

  it('garde les questions utilisables et écarte les autres', () => {
    const qs = normalizeAiQuestions(AI_OUTPUT);
    expect(qs).toHaveLength(2);
    expect(qs[0]).toMatchObject({ kind: 'qcm', context: 'Homme de 70 ans essoufflé la nuit.' });
    expect(qs[1]).toEqual({ kind: 'qroc', prompt: "Définis l'orthopnée.", context: '', answer: 'Dyspnée en position couchée.' });
  });

  it('lit le JSON même entouré de ```json', () => {
    expect(parseAiJson('```json\n{"questions": []}\n```')).toEqual({ questions: [] });
    expect(() => parseAiJson('pas du json')).toThrow(/format attendu/);
  });
});

describe('isAiReady', () => {
  it('désactivée par défaut', () => {
    expect(isAiReady(DEFAULT_AI_SETTINGS)).toBe(false);
  });
  it('demande une clé (sauf fournisseur personnalisé, ex. modèle local)', () => {
    expect(isAiReady({ ...DEFAULT_AI_SETTINGS, enabled: true })).toBe(false);
    expect(isAiReady({ ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'k' })).toBe(true);
    expect(isAiReady({ ...DEFAULT_AI_SETTINGS, enabled: true, provider: 'custom', baseUrl: 'http://localhost:11434/v1', model: 'llama' })).toBe(true);
    expect(isAiReady({ ...DEFAULT_AI_SETTINGS, enabled: true, provider: 'openai', apiKey: 'k' })).toBe(false); // modèle à préciser
  });
});

describe('fournisseur Claude (Anthropic)', () => {
  const message = {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
    content: [{ type: 'text', text: JSON.stringify(AI_OUTPUT) }],
    stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200 },
  };

  it('impose le format JSON, active le repli, et renvoie les questions', async () => {
    const fetch = fakeFetch(message);
    const ai = { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'sk-test', count: 4 };
    const qs = await generateQuestionsWithAI(LESSON, ai, { fetch });
    expect(qs).toHaveLength(2);

    const { url, body, init } = fetch.calls[0];
    expect(url).toContain('/v1/messages');
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.fallbacks).toBe('default');
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('sk-test');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('explique une clé refusée', async () => {
    const fetch = fakeFetch({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
    const ai = { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'mauvaise' };
    await expect(generateQuestionsWithAI(LESSON, ai, { fetch })).rejects.toThrow(/Clé API refusée/);
  });

  it('signale un refus du modèle', async () => {
    const fetch = fakeFetch({ ...message, content: [], stop_reason: 'refusal' });
    const ai = { ...DEFAULT_AI_SETTINGS, enabled: true, apiKey: 'k' };
    await expect(generateQuestionsWithAI(LESSON, ai, { fetch })).rejects.toThrow(/refusé/);
  });
});

describe('fournisseurs compatibles OpenAI', () => {
  const completion = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(AI_OUTPUT) } }] };

  it('appelle /chat/completions de Mistral avec la clé et le modèle', async () => {
    const fetch = fakeFetch(completion);
    const ai = { ...DEFAULT_AI_SETTINGS, enabled: true, provider: 'mistral', apiKey: 'mk', model: 'mon-modele' };
    const qs = await generateQuestionsWithAI(LESSON, ai, { fetch });
    expect(qs).toHaveLength(2);
    const { url, body, init } = fetch.calls[0];
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(body).toMatchObject({ model: 'mon-modele', response_format: { type: 'json_object' } });
    expect(init.headers.Authorization).toBe('Bearer mk');
  });

  it('utilise l\'adresse personnalisée, sans clé (modèle local)', async () => {
    const fetch = fakeFetch(completion);
    const ai = { ...DEFAULT_AI_SETTINGS, enabled: true, provider: 'custom', baseUrl: 'http://localhost:11434/v1/', model: 'llama' };
    await generateQuestionsWithAI(LESSON, ai, { fetch });
    expect(fetch.calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
    expect(fetch.calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('explique les erreurs courantes', async () => {
    const ai = { ...DEFAULT_AI_SETTINGS, enabled: true, provider: 'openai', apiKey: 'k', model: 'm' };
    await expect(generateQuestionsWithAI(LESSON, ai, { fetch: fakeFetch({}, 429) })).rejects.toThrow(/crédit épuisé/);
    const offline = async () => { throw new TypeError('Failed to fetch'); };
    await expect(generateQuestionsWithAI(LESSON, ai, { fetch: offline })).rejects.toThrow(/joindre le service/);
  });
});
