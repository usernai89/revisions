// =============================================================
// ai/prompt.js — Ce qu'on demande à l'IA, et la vérification de sa réponse
// =============================================================
// Cette partie est la même quel que soit le fournisseur (Claude, OpenAI, Mistral…).
//
// On demande des questions au format JSON :
//   { "questions": [ { kind, context, prompt, answer, options, explanation }, ... ] }
//   - kind        : "qcm" ou "qroc"
//   - context     : énoncé de cas clinique ("" s'il n'y en a pas)
//   - prompt      : la question
//   - answer      : la réponse attendue (QROC ; "" pour un QCM)
//   - options     : les propositions du QCM [{ text, correct }] ([] pour une QROC)
//   - explanation : explication de la correction (facultatif, "" sinon)
//
// L'IA peut se tromper de format : normalizeAiQuestions() vérifie et nettoie
// chaque question, et écarte celles qui sont inutilisables.

/** Schéma JSON de la réponse (utilisé pour imposer le format quand le fournisseur le permet). */
export const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['qcm', 'qroc'] },
          context: { type: 'string' },
          prompt: { type: 'string' },
          answer: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                correct: { type: 'boolean' },
              },
              required: ['text', 'correct'],
              additionalProperties: false,
            },
          },
          explanation: { type: 'string' },
        },
        required: ['kind', 'context', 'prompt', 'answer', 'options', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

/**
 * Construit la consigne envoyée à l'IA.
 * @param {object} lesson — { title, text, highlights }
 * @param {object} options — { count, subjectName, existingPrompts }
 * @returns {{ system: string, user: string }}
 */
export function buildPrompt(lesson, { count = 10, subjectName = '', existingPrompts = [] } = {}) {
  const system = [
    "Tu aides un étudiant en médecine à réviser. Tu écris des questions d'entraînement en français,",
    'à partir du cours fourni, comme celles des examens : précises, sans ambiguïté, sur les points importants.',
    "Appuie-toi uniquement sur le contenu du cours : n'invente pas de notion qui n'y figure pas.",
    'Réponds uniquement avec un objet JSON valide, sans texte autour.',
  ].join(' ');

  const highlights = lesson.highlights?.length
    ? `\nPoints que l'étudiant a surlignés (à couvrir en priorité) :\n${lesson.highlights.map((h) => `- ${h}`).join('\n')}\n`
    : '';
  const avoid = existingPrompts.length
    ? `\nQuestions qui existent déjà (n'en fais pas de doublon) :\n${existingPrompts.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  const user = `Matière : ${subjectName || 'non précisée'}
Leçon : ${lesson.title}
${highlights}${avoid}
Écris ${count} questions variées sur ce cours :
- environ deux tiers de QCM : 4 ou 5 propositions, une ou plusieurs justes, avec une explication courte de la correction ;
- le reste en QROC : une question appelant une réponse courte (un mot, une liste, une phrase), avec la réponse attendue ;
- quand le cours s'y prête, transforme quelques questions en cas clinique : un court énoncé (âge, terrain, symptômes) dans "context", puis la question.

Format JSON attendu :
{"questions": [{"kind": "qcm" ou "qroc", "context": "énoncé du cas clinique ou chaîne vide", "prompt": "la question", "answer": "réponse attendue (QROC) ou chaîne vide (QCM)", "options": [{"text": "proposition", "correct": true ou false}] (liste vide pour une QROC), "explanation": "explication ou chaîne vide"}]}

Cours :
"""
${lesson.text}
"""`;

  return { system, user };
}

/**
 * Lit la réponse de l'IA (texte JSON, éventuellement entouré de ```json … ```).
 * Lance une erreur lisible si ce n'est pas du JSON.
 */
export function parseAiJson(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("L'IA n'a pas répondu dans le format attendu. Réessaie.");
  }
}

/**
 * Vérifie et nettoie les questions renvoyées par l'IA.
 * Garde seulement les questions utilisables, au format de l'appli.
 */
export function normalizeAiQuestions(data) {
  const list = Array.isArray(data?.questions) ? data.questions : [];
  const out = [];
  for (const q of list) {
    const prompt = str(q?.prompt);
    if (!prompt) continue;
    const context = str(q.context);
    const explanation = str(q.explanation);

    const options = Array.isArray(q.options)
      ? q.options.map((o) => ({ text: str(o?.text), correct: o?.correct === true })).filter((o) => o.text)
      : [];

    // Un QCM doit avoir au moins 2 propositions dont au moins une juste.
    if (q.kind === 'qcm' && options.length >= 2 && options.some((o) => o.correct)) {
      out.push({ kind: 'qcm', prompt, context, options: options.slice(0, 8), explanation, answer: '' });
      continue;
    }
    // Sinon, c'est une QROC (si une réponse est fournie).
    const answer = str(q.answer) || explanation;
    if (answer) out.push({ kind: 'qroc', prompt, context, answer });
  }
  return out;
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}
