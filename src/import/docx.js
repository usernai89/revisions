// =============================================================
// import/docx.js — Extraction du texte d'un fichier Word (.docx)
// =============================================================
// On utilise mammoth.js, qui transforme le .docx en HTML simple
// (titres, paragraphes, listes, tableaux). On repasse ensuite ce HTML
// en texte, en gardant les listes sous forme de puces "- ",
// pour que le générateur de questions puisse les reconnaître.

import { cleanText } from '../text.js';

/** Lit un fichier .docx et renvoie son texte nettoyé. */
export async function extractDocxText(file) {
  // mammoth est chargé seulement quand on importe un Word.
  const mammoth = (await import('mammoth')).default;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return cleanText(htmlToText(html));
}

/**
 * Transforme le HTML produit par mammoth en texte, une ligne par bloc :
 *  - titres (h1…h6) et paragraphes → une ligne chacun ;
 *  - éléments de liste (li)        → "- élément" ;
 *  - cellules de tableau           → séparées par " | ".
 */
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines = [];

  const walk = (node) => {
    for (const el of node.children) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        for (const li of el.children) {
          // Texte de l'élément sans ses sous-listes, puis les sous-listes.
          const own = [...li.childNodes]
            .filter((n) => !['UL', 'OL'].includes(n.nodeName))
            .map((n) => n.textContent)
            .join('')
            .trim();
          if (own) lines.push(`- ${own}`);
          walk(li);
        }
      } else if (tag === 'table') {
        for (const tr of el.querySelectorAll('tr')) {
          const cells = [...tr.children].map((td) => td.textContent.trim()).filter(Boolean);
          if (cells.length) lines.push(cells.join(' | '));
        }
        lines.push('');
      } else if (/^(p|h[1-6])$/.test(tag)) {
        const text = el.textContent.trim();
        if (text) {
          // Ligne vide avant un titre, pour aérer.
          if (tag.startsWith('h')) lines.push('');
          lines.push(text);
        }
      } else {
        walk(el);
      }
    }
  };

  walk(doc.body);
  return lines.join('\n');
}
