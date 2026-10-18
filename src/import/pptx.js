// =============================================================
// import/pptx.js — Extraction du texte d'un PowerPoint (.pptx)
// =============================================================
// Un .pptx est en fait un fichier ZIP qui contient une page XML par diapositive :
//   ppt/slides/slide1.xml, slide2.xml, ...
// Dans chaque diapositive :
//   - <p:sp>  = une forme (zone de texte, titre...)
//   - <a:p>   = un paragraphe
//   - <a:t>   = un morceau de texte
// On lit les diapositives dans l'ordre, et pour chacune :
//   - le titre devient une ligne normale (« Titre : » si suivi de puces) ;
//   - le texte des zones de contenu devient des puces "- ", comme à l'écran.
// Les notes du présentateur sont ajoutées à la fin de chaque diapositive.

import { cleanText } from '../text.js';

/**
 * Trouve les balises d'un nom donné (ex. 'a:p') à l'intérieur d'un élément.
 * PowerPoint utilise toujours les préfixes "p:" (diapositive) et "a:" (texte).
 */
function tags(el, name) {
  return [...el.getElementsByTagName(name)];
}

/** Lit un fichier .pptx et renvoie son texte nettoyé. */
export async function extractPptxText(file, onProgress = () => {}) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Liste des diapositives, triées par numéro (slide2 avant slide10).
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const parts = [];
  for (let i = 0; i < slidePaths.length; i++) {
    onProgress(i + 1, slidePaths.length);
    const n = slideNumber(slidePaths[i]);
    const slideXml = await zip.file(slidePaths[i]).async('string');
    let text = slideToText(slideXml);

    const notes = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    if (notes) {
      const notesText = notesToText(await notes.async('string'));
      if (notesText) text += `\n${notesText}`;
    }
    if (text.trim()) parts.push(text);
  }
  return cleanText(parts.join('\n\n'));
}

function slideNumber(path) {
  return Number(path.match(/slide(\d+)\.xml$/)[1]);
}

/** Texte d'un paragraphe <a:p> : on colle ses morceaux <a:t>. */
function paragraphText(p) {
  return tags(p, 'a:t').map((t) => t.textContent).join('').trim();
}

/** Transforme le XML d'une diapositive en texte (titre + puces). */
export function slideToText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const titleLines = [];
  const bodyLines = [];

  for (const shape of tags(doc, 'p:sp')) {
    const ph = tags(shape, 'p:ph')[0]; // "placeholder" (zone prévue par le modèle)
    const phType = ph?.getAttribute('type') ?? (ph ? 'body' : null);
    const isTitle = phType === 'title' || phType === 'ctrTitle';
    // Les numéros de diapo, dates et pieds de page ne nous intéressent pas.
    if (['sldNum', 'dt', 'ftr', 'hdr'].includes(phType)) continue;

    for (const p of tags(shape, 'a:p')) {
      const text = paragraphText(p);
      if (!text) continue;
      if (isTitle) {
        titleLines.push(text);
        continue;
      }
      // Dans une zone de contenu, PowerPoint affiche des puces par défaut,
      // sauf si le paragraphe dit explicitement "pas de puce" (<a:buNone>).
      const noBullet = tags(p, 'a:buNone').length > 0;
      const hasBullet = tags(p, 'a:buChar').length > 0 ||
        tags(p, 'a:buAutoNum').length > 0;
      const bullet = hasBullet || (phType === 'body' && !noBullet) || phType === 'obj';
      bodyLines.push(bullet ? `- ${text}` : text);
    }
  }

  let title = titleLines.join(' ');
  // Un titre suivi de puces → "Titre :" pour que la liste soit reconnue.
  if (title && bodyLines.some((l) => l.startsWith('- ')) && !title.endsWith(':')) title += ' :';
  return [title, ...bodyLines].filter(Boolean).join('\n');
}

/** Texte des notes du présentateur (on ignore le numéro de diapo). */
function notesToText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const lines = [];
  for (const shape of tags(doc, 'p:sp')) {
    const ph = tags(shape, 'p:ph')[0];
    if (ph?.getAttribute('type') !== 'body') continue; // seulement la zone de notes
    for (const p of tags(shape, 'a:p')) {
      const text = paragraphText(p);
      if (text) lines.push(text);
    }
  }
  return lines.join('\n');
}
