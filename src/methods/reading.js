// =============================================================
// methods/reading.js — J0 : Lecture guidée avec surlignage
// =============================================================
// Le cours est affiché phrase par phrase.
// Touche une phrase pour la surligner (re-touche pour enlever).
// Les phrases surlignées sont enregistrées dans la leçon
// et seront réutilisées pour le rappel actif (J3).

import { db } from '../db.js';
import { toBlocks } from '../text.js';
import { escapeHtml } from '../ui.js';

export function run(container, { lesson }, finish) {
  const highlights = new Set(lesson.highlights ?? []);
  const blocks = toBlocks(lesson.text);

  container.innerHTML = `
    <p class="muted">Lis attentivement. <strong>Touche une phrase</strong> pour surligner les points importants.</p>
    <div class="reader">
      ${blocks.map(renderBlock).join('')}
    </div>
    <p class="muted" id="hl-count"></p>
    <button class="btn-primary btn-block" id="done">✅ J'ai fini la lecture</button>
  `;

  const counter = container.querySelector('#hl-count');
  const refreshCount = () => {
    counter.textContent = `${highlights.size} point(s) surligné(s)`;
  };

  // Marque les phrases déjà surlignées (si on revient sur la lecture).
  container.querySelectorAll('.sent').forEach((el) => {
    if (highlights.has(el.textContent)) el.classList.add('hl');
  });
  refreshCount();

  // Un seul écouteur pour toutes les phrases (plus léger).
  container.querySelector('.reader').addEventListener('click', async (e) => {
    const sent = e.target.closest('.sent');
    if (!sent) return;
    const text = sent.textContent;
    if (highlights.has(text)) highlights.delete(text);
    else highlights.add(text);
    sent.classList.toggle('hl');
    refreshCount();
    // Enregistré tout de suite : rien n'est perdu si on ferme l'appli.
    await db.lessons.update(lesson.id, { highlights: [...highlights] });
  });

  container.querySelector('#done').onclick = () => finish({ highlights: highlights.size });
}

function renderBlock(block) {
  const sentences = block.sentences.map((s) => `<span class="sent">${escapeHtml(s)}</span>`).join(' ');
  if (block.kind === 'title') return `<h3>${sentences}</h3>`;
  if (block.kind === 'bullet') return `<p class="bullet">${sentences}</p>`;
  return `<p>${sentences}</p>`;
}
