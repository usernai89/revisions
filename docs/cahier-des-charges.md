# revisions
Je veux que tu construises une application de révision .

## Objectif
Une appli qui planifie automatiquement mes révisions selon la courbe de l'oubli et d'autres méthodes de révision(répétition espacée) 

## Plateforme
Application web installable sur téléphone (PWA), qui fonctionne HORS LIGNE. Toutes les données restent sur mon téléphone. Aucun service payant, aucun abonnement.

## Fonctionnalités principales

1. **Matières et leçons**
   - Je crée moi même mes matières (ex : Sémiologie, Anatomie...).
   - Dans chaque matière, j'ajoute des leçons en important un fichier : PDF, Word (.docx) ou PowerPoint (.pptx). L'appli extrait le texte et le garde dans la leçon.
   - Je peux aussi coller du texte directement.

2. **Planification automatique (courbe de l'oubli)**
   - Quand j'ajoute une leçon, l'appli programme toute seule les révisions : J0, J1, J3, J7, J14, J30 (intervalles modifiables).
   - Si je rate une révision, elle est reportée automatiquement, sans tout casser.
   - Écran "Aujourd'hui" : la liste de ce que je dois réviser, triée par priorité.
   - Je règle mon temps disponible par jour (ex : 1h en semaine, 3h le week-end). L'appli ne me donne jamais plus que ça et répartit la charge sur les jours suivants.

3. **Une méthode différente à chaque révision**
   - J0 : lecture guidée du cours, avec possibilité de surligner les points importants.
   - J1 : QCM ou QROC (l'appli choisit le plus adapté).
   - J3 : questions de rappel actif (je réponds de mémoire, puis je vois la correction).
   - J7 : texte à trous (phrases du cours avec des mots-clés cachés).
   - J14 et plus : mélange, avec cas cliniques ou flashcards.
   La méthode par étape doit être modifiable dans les réglages.

4. **Génération automatique des exercices, SANS service payant**
   - Version 1 : l'appli génère les textes à trous et les flashcards à partir du texte du cours (détection des mots-clés, définitions, listes).
   - Je peux aussi écrire mes propres QCM/QROC.
   - Prévois une architecture qui permettrait d'ajouter plus tard une IA (clé API) pour générer de meilleurs QCM/QROC, mais désactivée par défaut.

5. **Suivi**
   - Pour chaque question : "facile / moyen / difficile". Les questions difficiles reviennent plus vite.
   - Statistiques simples par matière : leçons vues, taux de réussite, révisions en retard.

## Contraintes
- Interface en français, gros boutons, simple et rapide à utiliser (je révise souvent dans les transports ou entre deux cours).
- Mode sombre.
- Les données sont stockées localement (IndexedDB) avec un bouton pour exporter/importer une sauvegarde.
- Code simple et bien commenté pour que je puisse le comprendre.

## Façon de travailler
1. Avant d'écrire du code, propose-moi un plan court, les technologies choisies et la structure des fichiers, puis attends mon accord.
2. Construis d'abord un MVP : matières + import d'un PDF + planification J0/J1/J3 + écran "Aujourd'hui". Puis ajoute le reste une fonction à la fois.
3. À chaque étape, explique-moi comment lancer et tester l'appli.
4. Si une information te manque, pose-moi une question au lieu de deviner.