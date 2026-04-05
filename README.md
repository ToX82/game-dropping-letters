# LETTERE – Puzzle Arcade

Gioco di parole in italiano. Le lettere cadono e si accumulano in una griglia: seleziona le tessere per comporre parole valide prima che una colonna si riempia.

## Come si gioca

1. Le lettere cadono una alla volta in colonne casuali
2. Tocca (o clicca) le tessere per comporre una parola
3. Premi **OK** per confermare la parola
4. Parole lunghe e combo veloci = più punti
5. Se una colonna si riempia fino in cima = **game over**

## Funzionalità

- **Dizionario italiano** con 60.000+ parole
- **Sistema combo**: parole consecutive entro 5 secondi moltiplicano i punti
- **Missioni**: obiettivi progressivi con bonus punti
- **Livelli**: la velocità aumenta ogni 500 punti
- **Condivisione**: bottone WhatsApp per condividere il risultato
- **Audio**: effetti sonori sintetizzati via Web Audio API
- **Responsive**: ottimizzato per mobile con touch events

## Punteggio

| Condizione | Punti |
|---|---|
| Parola base | lunghezza × 10 × combo |
| Parola ≥ 5 lettere | +lunghezza × 20 |
| Parola ≥ 7 lettere | +lunghezza × 50 |
| Missione completata | +100 |

## Stack tecnico

- HTML + CSS (Tailwind via CDN) + JavaScript vanilla
- [Alpine.js](https://alpinejs.dev/) per reattività UI
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) per gli effetti sonori
- Nessun build step, nessuna dipendenza da installare

## Avvio

Servire la cartella con qualsiasi static file server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Apri `http://localhost:8000/letters.html` nel browser.

## Struttura file

```
├── letters.html   Layout e template Alpine.js
├── game.js        Logica di gioco, audio, effetti visivi
├── style.css      Stili personalizzati (tile, animazioni, bottoni)
└── ita.txt        Dizionario italiano (60.000+ parole)
```
