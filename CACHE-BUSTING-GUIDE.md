# Guida al Cache Busting per GitHub Pages

## Problema
Quando pubblichi aggiornamenti su GitHub Pages, i browser potrebbero continuare a utilizzare le versioni cached dei file, impedendo agli utenti di vedere le modifiche più recenti.

## Soluzioni Implementate

### 1. Meta Tag di Cache Control
Aggiunti meta tag nell'HTML per disabilitare il caching:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

### 2. Versioning dei File
I file CSS e JS ora includono parametri di versione:
```html
<link rel="stylesheet" href="styles.css?v=1.0.0">
<script src="app.js?v=1.0.0"></script>
<script src="mobile.js?v=1.0.0"></script>
```

### 3. Cache Buster Automatico
Il file `cache-buster.js` gestisce automaticamente:
- Rilevamento di nuove versioni
- Pulizia della cache del browser
- Notifiche di aggiornamento agli utenti
- Timestamp dinamici per forzare il ricaricamento

### 4. Service Worker Aggiornato
Il service worker ora:
- Gestisce i file con versioning in modo speciale
- Forza il fetch dalla rete per file con parametri `?v=` o `?t=`
- Supporta la pulizia manuale della cache

## Come Usare

### Per Aggiornamenti Minori
1. Modifica i tuoi file
2. Incrementa la versione in `cache-buster.js`:
   ```javascript
   const APP_VERSION = '1.0.2'; // Incrementa questo numero
   ```
3. Aggiorna le versioni nell'HTML se necessario:
   ```html
   <script src="app.js?v=1.0.2"></script>
   ```
4. Incrementa la versione nel service worker:
   ```javascript
   const CACHE_VERSION = '1.0.2';
   ```
5. Fai commit e push su GitHub

### Per Aggiornamenti Maggiori
1. Segui i passi sopra
2. Considera di cambiare il nome della cache nel service worker
3. Testa in locale prima del deploy

### Per Forzare il Ricaricamento Immediato
Gli utenti possono:
- Premere Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)
- Aprire DevTools → Network → spuntare "Disable cache"
- Usare il pulsante "Force Reload" (visibile solo in localhost)

## Funzioni di Debug

In console del browser sono disponibili:
```javascript
// Controlla la versione corrente
cacheBuster.version

// Forza il ricaricamento completo
cacheBuster.forceReload()

// Controlla manualmente gli aggiornamenti
cacheBuster.checkForUpdates()

// Aggiungi cache buster ai file
cacheBuster.addCacheBuster()
```

## Checklist per il Deploy

- [ ] Incrementato `APP_VERSION` in `cache-buster.js`
- [ ] Incrementato `CACHE_VERSION` in `sw.js`
- [ ] Aggiornato i parametri `?v=` nell'HTML se necessario
- [ ] Testato in locale
- [ ] Fatto commit e push
- [ ] Verificato che GitHub Pages abbia fatto il deploy
- [ ] Testato su browser diversi
- [ ] Verificato che gli utenti vedano la notifica di aggiornamento

## Note Aggiuntive

- Il sistema mostra automaticamente una notifica verde quando rileva una nuova versione
- In ambiente di sviluppo (localhost) appare un pulsante rosso "Force Reload"
- Il service worker gestisce automaticamente la pulizia delle cache vecchie
- I file con parametri di versione vengono sempre scaricati freschi dalla rete

## Troubleshooting

Se gli utenti continuano a vedere la versione vecchia:
1. Verifica che la versione sia stata incrementata correttamente
2. Controlla che GitHub Pages abbia completato il deploy
3. Chiedi agli utenti di fare hard refresh (Ctrl+F5)
4. Verifica che il service worker sia aggiornato nelle DevTools