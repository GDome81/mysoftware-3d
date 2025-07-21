# 3D Model Viewer PWA

Una Progressive Web App (PWA) per visualizzare modelli 3D in formato FBX, OBJ e GLTF/GLB su dispositivi touch come tablet e smartphone.

## Caratteristiche

- ✅ **Supporto Multi-formato**: Carica e visualizza modelli 3D in formato FBX, OBJ e GLTF/GLB
- ✅ **Controlli Touch**: Ottimizzato per dispositivi touch con gesture intuitive
- ✅ **PWA**: Installabile come app nativa su dispositivi mobili
- ✅ **Offline**: Funziona anche senza connessione internet con pagina di fallback dedicata
- ✅ **Responsive**: Si adatta a schermi di diverse dimensioni e orientamenti
- ✅ **Wireframe**: Modalità wireframe per analisi dettagliata
- ✅ **Fullscreen**: Modalità schermo intero per immersione totale
- ✅ **Oggetti Cliccabili**: Supporto per interazioni con parti specifiche del modello
- ✅ **Feedback Tattile**: Vibrazione su dispositivi che lo supportano
- ✅ **Aggiornamenti Automatici**: Notifica quando è disponibile una nuova versione

## Controlli Touch

- **Un dito**: Ruota il modello
- **Due dita (pinch)**: Zoom in/out
- **Due dita (pan)**: Sposta la vista
- **Tap su oggetto**: Attiva l'interazione con l'oggetto cliccabile
- **Reset Vista**: Ripristina la posizione iniziale della camera
- **Wireframe**: Attiva/disattiva la modalità wireframe
- **Schermo Intero**: Entra/esci dalla modalità fullscreen

## Funzionalità Mobile

- **Indicatore Offline**: Banner che indica quando l'app è offline
- **Prompt di Installazione**: Suggerimento per installare l'app sul dispositivo
- **Orientamento Adattivo**: Ottimizzato sia per orientamento verticale che orizzontale
- **Feedback Tattile**: Vibrazione quando si interagisce con oggetti cliccabili
- **Aggiornamenti Automatici**: Notifica quando è disponibile una nuova versione dell'app

## Tecnologie Utilizzate

- **Three.js**: Libreria 3D per WebGL
- **Loaders**: Supporto per modelli FBX, OBJ e GLTF/GLB
- **OrbitControls**: Controlli di navigazione 3D ottimizzati per touch
- **Raycasting**: Per l'interazione con oggetti cliccabili
- **Service Worker**: Cache avanzata e funzionalità offline
- **Web App Manifest**: Installazione come PWA con screenshot e icone
- **Vibration API**: Feedback tattile su dispositivi supportati
- **Orientation API**: Adattamento all'orientamento del dispositivo
- **Network Information API**: Rilevamento dello stato della connessione

## Installazione

### Come PWA (Consigliato)

1. Apri l'applicazione nel browser del tuo dispositivo mobile
2. Cerca l'opzione "Aggiungi alla schermata home" o "Installa app"
3. Segui le istruzioni per installare la PWA

### Server Locale

1. Clona o scarica il repository
2. Avvia un server HTTP locale:
   ```bash
   # Con Python 3
   python -m http.server 8000
   
   # Con Node.js (http-server)
   npx http-server
   
   # Con PHP
   php -S localhost:8000
   ```
3. Apri `http://localhost:8000` nel browser

## Utilizzo

1. **Carica un modello**: Clicca su "Carica Modello FBX" e seleziona un file .fbx
2. **Esplora il modello**: Usa i controlli touch per navigare:
   - Trascina con un dito per ruotare
   - Pizzica per zoomare
   - Usa due dita per spostare la vista
3. **Utilizza i controlli**: 
   - Reset Vista per tornare alla posizione iniziale
   - Wireframe per vedere la struttura del modello
   - Schermo Intero per un'esperienza immersiva

## Formati Supportati

- **FBX**: Formato principale supportato
- **Texture**: Supportate automaticamente se incluse nel file FBX
- **Animazioni**: Rilevate automaticamente (se presenti nel modello)

## Compatibilità

- **Browser**: Chrome, Firefox, Safari, Edge (versioni moderne)
- **Dispositivi**: Smartphone e tablet con supporto WebGL
- **Sistema Operativo**: iOS, Android, Windows, macOS, Linux

## Prestazioni

- **Modelli Consigliati**: Fino a 100k poligoni per prestazioni ottimali su mobile
- **Texture**: Risoluzione massima consigliata 2048x2048
- **Cache**: I file vengono memorizzati nella cache per accesso offline

## Risoluzione Problemi

### Il modello non si carica
- Verifica che il file sia in formato .fbx valido
- Controlla che il file non sia troppo grande (>50MB)
- Assicurati che il browser supporti WebGL

### Prestazioni lente
- Riduci la complessità del modello
- Ottimizza le texture
- Chiudi altre applicazioni per liberare memoria

### L'app non si installa
- Verifica che il browser supporti le PWA
- Controlla la connessione internet per il primo caricamento
- Prova a ricaricare la pagina

## Sviluppo

### Struttura del Progetto
```
├── index.html          # Pagina principale
├── styles.css          # Stili CSS
├── app.js             # Logica principale JavaScript
├── sw.js              # Service Worker
├── manifest.json      # Manifest PWA
├── icon-192x192.png   # Icona 192x192
├── icon-512x512.png   # Icona 512x512
└── README.md          # Documentazione
```

### Personalizzazione

- **Colori**: Modifica le variabili CSS in `styles.css`
- **Controlli**: Personalizza i controlli in `app.js`
- **Cache**: Aggiorna la lista dei file in `sw.js`

## Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file LICENSE per i dettagli.

## Contributi

I contributi sono benvenuti! Per favore:
1. Fai un fork del progetto
2. Crea un branch per la tua feature
3. Committa le modifiche
4. Fai un push del branch
5. Apri una Pull Request

## Supporto

Per problemi o domande, apri un issue nel repository GitHub.