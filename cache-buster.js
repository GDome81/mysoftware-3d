// Cache Buster - Forza il ricaricamento dei file quando vengono aggiornati
(function() {
    'use strict';
    
    // Versione dell'app - incrementa questo numero quando fai deploy
    const APP_VERSION = '1.0.2';
    
    // Funzione per aggiungere timestamp ai file
    function addCacheBuster() {
        const timestamp = Date.now();
        const version = APP_VERSION;
        
        // Aggiorna tutti i link CSS
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        cssLinks.forEach(link => {
            if (!link.href.includes('?v=')) {
                link.href += `?v=${version}&t=${timestamp}`;
            } else {
                // Aggiorna la versione esistente
                link.href = link.href.replace(/\?v=[^&]*/, `?v=${version}`) + `&t=${timestamp}`;
            }
        });
        
        // Aggiorna tutti gli script
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            if (script.src.includes('app.js') || script.src.includes('mobile.js')) {
                if (!script.src.includes('?v=')) {
                    script.src += `?v=${version}&t=${timestamp}`;
                } else {
                    // Aggiorna la versione esistente
                    script.src = script.src.replace(/\?v=[^&]*/, `?v=${version}`) + `&t=${timestamp}`;
                }
            }
        });
    }
    
    // Funzione per controllare se c'è una nuova versione
    function checkForUpdates() {
        const currentVersion = localStorage.getItem('app_version');
        
        if (currentVersion !== APP_VERSION) {
            console.log(`Nuova versione rilevata: ${APP_VERSION} (precedente: ${currentVersion})`);
            
            // Pulisci la cache del browser
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => {
                        caches.delete(name);
                    });
                });
            }
            
            // Salva la nuova versione
            localStorage.setItem('app_version', APP_VERSION);
            
            // Mostra notifica di aggiornamento
            showUpdateNotification();
        }
    }
    
    // Mostra notifica di aggiornamento
    function showUpdateNotification() {
        const notification = document.createElement('div');
        notification.id = 'update-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                text-align: center;
                max-width: 90%;
            ">
                ✅ App aggiornata alla versione ${APP_VERSION}!
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    margin-left: 10px;
                    cursor: pointer;
                    font-size: 16px;
                ">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Rimuovi automaticamente dopo 5 secondi
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    // Funzione per forzare il ricaricamento completo
    function forceReload() {
        // Pulisci localStorage (tranne le impostazioni utente)
        const userSettings = localStorage.getItem('user_settings');
        localStorage.clear();
        if (userSettings) {
            localStorage.setItem('user_settings', userSettings);
        }
        
        // Ricarica la pagina senza cache
        window.location.reload(true);
    }
    
    // Aggiungi pulsante per forzare il ricaricamento (solo in sviluppo)
    function addForceReloadButton() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const button = document.createElement('button');
            button.innerHTML = '🔄 Force Reload';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: #FF5722;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 4px;
                cursor: pointer;
                z-index: 9999;
                font-size: 12px;
            `;
            button.onclick = forceReload;
            document.body.appendChild(button);
        }
    }
    
    // Inizializza quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            checkForUpdates();
            addForceReloadButton();
        });
    } else {
        checkForUpdates();
        addForceReloadButton();
    }
    
    // Esponi funzioni globalmente per debug
    window.cacheBuster = {
        version: APP_VERSION,
        forceReload: forceReload,
        checkForUpdates: checkForUpdates,
        addCacheBuster: addCacheBuster
    };
    
})();