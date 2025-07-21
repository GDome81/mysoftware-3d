/**
 * mobile.js - Miglioramenti per dispositivi mobili e PWA
 * Questo file contiene funzionalità specifiche per migliorare l'esperienza su dispositivi mobili
 * e funzionalità PWA come la gestione dello stato online/offline.
 */

class MobileEnhancer {
    constructor() {
        this.initNetworkStatus();
        this.initInstallPrompt();
        this.initTouchEnhancements();
        this.initOrientationHandler();
    }

    /**
     * Inizializza il monitoraggio dello stato della rete
     */
    initNetworkStatus() {
        // Crea un banner per lo stato offline
        this.offlineBanner = document.createElement('div');
        this.offlineBanner.className = 'offline-banner';
        this.offlineBanner.innerHTML = '<span>⚠️ Sei offline. Alcune funzionalità potrebbero non essere disponibili.</span>';
        this.offlineBanner.style.display = 'none';
        document.body.appendChild(this.offlineBanner);

        // Aggiungi stili CSS per il banner
        const style = document.createElement('style');
        style.textContent = `
            .offline-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background-color: #ff9800;
                color: white;
                text-align: center;
                padding: 8px;
                z-index: 9999;
                font-size: 14px;
                transition: transform 0.3s ease;
                transform: translateY(-100%);
            }
            .offline-banner.visible {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);

        // Gestisci gli eventi online/offline
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        
        // Controlla lo stato iniziale
        this.updateOnlineStatus();
    }

    /**
     * Aggiorna l'interfaccia in base allo stato della connessione
     */
    updateOnlineStatus() {
        if (navigator.onLine) {
            this.offlineBanner.classList.remove('visible');
            setTimeout(() => {
                this.offlineBanner.style.display = 'none';
            }, 300);
            console.log('Applicazione online');
        } else {
            this.offlineBanner.style.display = 'block';
            setTimeout(() => {
                this.offlineBanner.classList.add('visible');
            }, 10);
            console.log('Applicazione offline');
        }
    }

    /**
     * Gestisce il prompt di installazione dell'app
     */
    initInstallPrompt() {
        let deferredPrompt;

        // Crea un banner per l'installazione
        const installBanner = document.createElement('div');
        installBanner.className = 'install-banner';
        installBanner.innerHTML = `
            <span>Installa questa app sul tuo dispositivo</span>
            <button id="install-button">Installa</button>
            <button id="close-install-banner">✕</button>
        `;
        installBanner.style.display = 'none';
        document.body.appendChild(installBanner);

        // Aggiungi stili CSS per il banner di installazione
        const style = document.createElement('style');
        style.textContent = `
            .install-banner {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background-color: #2196F3;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                z-index: 9999;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                transition: transform 0.3s ease;
                transform: translateY(100%);
            }
            .install-banner.visible {
                transform: translateY(0);
            }
            .install-banner button {
                background-color: white;
                color: #2196F3;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
                cursor: pointer;
                margin-left: 10px;
            }
            .install-banner #close-install-banner {
                background: transparent;
                color: white;
                font-size: 18px;
                padding: 0 8px;
            }
        `;
        document.head.appendChild(style);

        // Intercetta l'evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            // Previeni la visualizzazione automatica del prompt
            e.preventDefault();
            // Salva l'evento per usarlo più tardi
            deferredPrompt = e;
            // Mostra il banner di installazione
            installBanner.style.display = 'flex';
            setTimeout(() => {
                installBanner.classList.add('visible');
            }, 10);
        });

        // Gestisci il click sul pulsante di installazione
        document.getElementById('install-button').addEventListener('click', async () => {
            if (!deferredPrompt) return;
            // Mostra il prompt di installazione
            deferredPrompt.prompt();
            // Attendi che l'utente risponda al prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // Resetta la variabile deferredPrompt - può essere usata solo una volta
            deferredPrompt = null;
            // Nascondi il banner
            installBanner.classList.remove('visible');
            setTimeout(() => {
                installBanner.style.display = 'none';
            }, 300);
        });

        // Gestisci il click sul pulsante di chiusura
        document.getElementById('close-install-banner').addEventListener('click', () => {
            installBanner.classList.remove('visible');
            setTimeout(() => {
                installBanner.style.display = 'none';
            }, 300);
        });

        // Nascondi il banner se l'app è già installata
        window.addEventListener('appinstalled', () => {
            console.log('PWA installata con successo');
            installBanner.classList.remove('visible');
            setTimeout(() => {
                installBanner.style.display = 'none';
            }, 300);
            deferredPrompt = null;
        });
    }

    /**
     * Migliora la gestione degli eventi touch
     */
    initTouchEnhancements() {
        // Previeni il doppio tap per lo zoom su dispositivi mobili
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Previeni il pinch zoom sul canvas
        const canvas = document.getElementById('three-canvas');
        if (canvas) {
            canvas.addEventListener('touchmove', (e) => {
                if (e.touches.length > 1) {
                    // Non prevenire il pinch zoom sul canvas perché è usato per lo zoom 3D
                    // Ma possiamo aggiungere logica personalizzata se necessario
                }
            }, { passive: false });
        }

        // Migliora la reattività dei pulsanti su mobile
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('touchstart', () => {
                button.classList.add('touch-active');
            });
            button.addEventListener('touchend', () => {
                button.classList.remove('touch-active');
            });
        });

        // Aggiungi stili per il feedback tattile
        const style = document.createElement('style');
        style.textContent = `
            button.touch-active {
                transform: scale(0.95);
                opacity: 0.9;
            }
            button {
                transition: transform 0.1s ease, opacity 0.1s ease;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Gestisce i cambiamenti di orientamento del dispositivo
     */
    initOrientationHandler() {
        // Rileva cambiamenti di orientamento
        window.addEventListener('orientationchange', () => {
            console.log('Orientamento cambiato');
            // Forza il ridimensionamento del renderer
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 200);
        });

        // Aggiungi classe al body in base all'orientamento
        const updateOrientation = () => {
            if (window.matchMedia("(orientation: portrait)").matches) {
                document.body.classList.remove('landscape');
                document.body.classList.add('portrait');
            } else {
                document.body.classList.remove('portrait');
                document.body.classList.add('landscape');
            }
        };

        // Controlla l'orientamento iniziale
        updateOrientation();

        // Ascolta i cambiamenti di orientamento
        window.addEventListener('orientationchange', updateOrientation);
    }
}

// Inizializza i miglioramenti per mobile quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
    new MobileEnhancer();
});