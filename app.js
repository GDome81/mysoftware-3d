class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentModel = null;
        this.isCurrentModelCompressed = false; // Traccia se il modello corrente è compresso
        this.isWireframe = false;
        this.isDarkBackground = false; // Default è sfondo chiaro
        this.lastMemoryCheck = 0;
        this.raycaster = null;
        this.mouse = null;
        this.clickableObjects = [];
        this.hoveredObject = null;
        this.modelLayers = {}; // Oggetto per memorizzare i layer del modello
        this.layerColors = {}; // Colori associati ai layer
        this.aggressiveOptimizationsEnabled = true; // Flag per controllare le ottimizzazioni aggressive
        this.isLoading = false; // Flag per prevenire caricamenti simultanei
        
        // Proprietà per il sistema di doppio tap
        this.lastSelectedObject = null;
        this.lastTapTime = 0;
        
        this.init();
        this.setupEventListeners();
    }
    
    // Funzioni per la gestione dei layer
    createLayersFromModel(model) {
        this.modelLayers = {};
        this.layerColors = {};
        
        if (!model) return;
        
        // Analizza il modello e crea layer basati sui nomi degli oggetti
        model.traverse((child) => {
            if (child.isMesh && child.name) {
                // Estrae il nome del layer dal nome dell'oggetto
                let layerName = this.extractLayerName(child.name);
                
                if (!this.modelLayers[layerName]) {
                    this.modelLayers[layerName] = [];
                    // Assegna un colore casuale al layer
                    this.layerColors[layerName] = this.generateRandomColor();
                }
                
                this.modelLayers[layerName].push(child);
                // Aggiungi riferimento al layer nell'oggetto
                child.userData.layer = layerName;
            }
        });
        
        this.updateHierarchyUI();
        
        // Applica ottimizzazione automatica per modelli complessi
        this.applyComplexModelOptimization();
    }
    
    // Funzione per ottimizzare automaticamente modelli complessi
    applyComplexModelOptimization() {
        const totalLayers = Object.keys(this.modelLayers).length;
        const totalObjects = Object.values(this.modelLayers).reduce((sum, layer) => sum + layer.length, 0);
        
        // Determina se il modello è complesso (molti livelli E molti oggetti)
        const isComplexModel = totalLayers >= 5 && totalObjects >= 100;
        
        if (isComplexModel) {
            console.log(`Modello complesso rilevato: ${totalLayers} livelli, ${totalObjects} oggetti totali. Applicando ottimizzazione automatica...`);
            
            // Calcola il numero di oggetti cliccabili per ogni livello
            const layerStats = Object.entries(this.modelLayers).map(([layerName, objects]) => {
                const clickableCount = objects.filter(obj => this.clickableObjects.includes(obj)).length;
                return {
                    name: layerName,
                    objects: objects,
                    totalCount: objects.length,
                    clickableCount: clickableCount,
                    score: clickableCount * 2 + objects.length // Priorità agli oggetti cliccabili
                };
            });
            
            // Ordina i livelli per importanza (più oggetti cliccabili = più importante)
            layerStats.sort((a, b) => b.score - a.score);
            
            // Mantieni visibili solo i primi 2 livelli più importanti
            const layersToKeepVisible = layerStats.slice(0, 2);
            const layersToHide = layerStats.slice(2);
            
            console.log('Livelli che rimarranno visibili:', layersToKeepVisible.map(l => `${l.name} (${l.clickableCount}/${l.totalCount})`));
            console.log('Livelli che verranno nascosti:', layersToHide.map(l => `${l.name} (${l.clickableCount}/${l.totalCount})`));
            
            // Nascondi i livelli meno importanti
            layersToHide.forEach(layerStat => {
                this.toggleLayerVisibility(layerStat.name, false);
            });
            
            // Aggiorna l'UI per riflettere i cambiamenti
            this.updateLayerCheckboxes();
            
            // Mostra un messaggio informativo all'utente
            const hiddenLayersCount = layersToHide.length;
            if (hiddenLayersCount > 0) {
                console.log(`Ottimizzazione applicata: ${hiddenLayersCount} livelli nascosti per migliorare le prestazioni.`);
                
                // Mostra un toast informativo (opzionale)
                this.showOptimizationToast(hiddenLayersCount, layersToKeepVisible.length);
            }
        }
    }
    
    // Funzione per aggiornare le checkbox dei livelli nell'UI
    updateLayerCheckboxes() {
        Object.entries(this.modelLayers).forEach(([layerName, objects]) => {
            const isVisible = objects.length > 0 && objects[0].visible;
            const checkbox = document.querySelector(`input[data-layer="${layerName}"]`);
            if (checkbox) {
                checkbox.checked = isVisible;
            }
        });
    }
    
    // Funzione per mostrare un toast informativo sull'ottimizzazione
    showOptimizationToast(hiddenCount, visibleCount) {
        const toast = document.createElement('div');
        toast.className = 'optimization-toast';
        toast.innerHTML = `
            <div style="
                position: fixed;
                top: 80px;
                right: 20px;
                background: #FF9800;
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 1000;
                max-width: 300px;
                font-size: 0.9rem;
                line-height: 1.4;
            ">
                <strong>🚀 Ottimizzazione Automatica</strong><br>
                Nascosti ${hiddenCount} livelli per migliorare le prestazioni.<br>
                <small>Visibili i ${visibleCount} livelli principali. Usa il menu Gerarchia per mostrare tutti i livelli.</small>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Rimuovi il toast dopo 5 secondi
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
    
    extractLayerName(objectName) {
        // Estrae il nome del layer dal nome dell'oggetto
        // Esempi: "Cubo_1" -> "Cubo", "Sfera_Centrale" -> "Sfera", "Engine_Part_01" -> "Engine"
        if (objectName.includes('_')) {
            return objectName.split('_')[0];
        }
        return objectName;
    }
    
    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    toggleLayerVisibility(layerName, visible) {
        if (!this.modelLayers[layerName]) return;
        
        this.modelLayers[layerName].forEach(object => {
            object.visible = visible;
        });
    }
    
    updateHierarchyUI() {
        const hierarchyTree = document.getElementById('hierarchyTree');
        const noHierarchyMsg = hierarchyTree.querySelector('.no-hierarchy');
        
        // Rimuovi il messaggio "nessun modello"
        if (noHierarchyMsg) {
            noHierarchyMsg.remove();
        }
        
        // Pulisci la lista esistente
        hierarchyTree.innerHTML = '';
        
        // Se non ci sono layer, mostra il messaggio
        if (Object.keys(this.modelLayers).length === 0) {
            hierarchyTree.innerHTML = '<p class="no-hierarchy">Nessun modello caricato</p>';
            return;
        }
        
        // Aggiungi pulsante "Mostra Tutti" se ci sono più layer
        if (Object.keys(this.modelLayers).length > 1) {
            const showAllBtn = document.createElement('button');
            showAllBtn.className = 'menu-item show-all-layers';
            showAllBtn.textContent = '👁 Mostra Tutti i Livelli';
            showAllBtn.style.cssText = `
                background: #4CAF50;
                color: white;
                margin-bottom: 10px;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                width: 100%;
                font-size: 0.9rem;
            `;
            showAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAllLayers();
            });
            hierarchyTree.appendChild(showAllBtn);
        }
        
        // Aggiungi ogni layer alla gerarchia
        Object.keys(this.modelLayers).forEach(layerName => {
            const layerNode = this.createLayerNode(layerName);
            hierarchyTree.appendChild(layerNode);
        });
    }
    
    createLayerNode(layerName) {
        const layerObjects = this.modelLayers[layerName];
        const clickableElements = layerObjects.filter(obj => this.clickableObjects.includes(obj));
        
        // Contenitore principale del layer
        const layerNode = document.createElement('div');
        layerNode.className = 'layer-node';
        
        // Header del layer
        const layerHeader = document.createElement('div');
        layerHeader.className = 'layer-header';
        
        // Icona di espansione
        const layerToggle = document.createElement('div');
        layerToggle.className = 'layer-toggle';
        layerToggle.textContent = '▶';
        
        // Checkbox per visibilità layer
        const layerCheckbox = document.createElement('input');
        layerCheckbox.type = 'checkbox';
        layerCheckbox.className = 'layer-checkbox';
        layerCheckbox.setAttribute('data-layer', layerName);
        // Controlla lo stato effettivo di visibilità del primo oggetto del layer
        const isLayerVisible = layerObjects.length > 0 && layerObjects[0].visible;
        layerCheckbox.checked = isLayerVisible;
        layerCheckbox.addEventListener('change', (e) => {
            this.toggleLayerVisibility(layerName, e.target.checked);
        });
        
        // Informazioni del layer
        const layerInfo = document.createElement('div');
        layerInfo.className = 'layer-info';
        
        const layerNameSpan = document.createElement('span');
        layerNameSpan.className = 'layer-name';
        layerNameSpan.textContent = layerName;
        
        const layerCount = document.createElement('span');
        layerCount.className = 'layer-count';
        layerCount.textContent = `${clickableElements.length}/${layerObjects.length}`;
        
        const layerColor = document.createElement('div');
        layerColor.className = 'layer-color';
        layerColor.style.backgroundColor = this.layerColors[layerName];
        
        layerInfo.appendChild(layerNameSpan);
        layerInfo.appendChild(layerCount);
        layerInfo.appendChild(layerColor);
        
        // Azioni del layer
        const layerActions = document.createElement('div');
        layerActions.className = 'layer-actions';
        
        // Pulsante "Show Only"
        const showOnlyBtn = document.createElement('button');
        showOnlyBtn.className = 'layer-show-only';
        showOnlyBtn.textContent = 'Show';
        showOnlyBtn.title = 'Mostra solo questo livello';
        showOnlyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (layerObjects && layerObjects.length > 0) {
                this.showOnlyLayer(layerObjects[0]); // Usa il primo oggetto del layer come riferimento
            } else {
                console.warn('Nessun oggetto trovato nel layer:', layerName);
            }
        });
        
        layerActions.appendChild(showOnlyBtn);
        
        layerHeader.appendChild(layerToggle);
        layerHeader.appendChild(layerCheckbox);
        layerHeader.appendChild(layerInfo);
        layerHeader.appendChild(layerActions);
        
        // Contenitore degli elementi
        const layerElements = document.createElement('div');
        layerElements.className = 'layer-elements';
        
        // Aggiungi elementi cliccabili
        clickableElements.forEach(element => {
            const elementItem = this.createElementItem(element);
            layerElements.appendChild(elementItem);
        });
        
        // Gestione espansione/contrazione
        layerHeader.addEventListener('click', (e) => {
            if (e.target === layerCheckbox) return; // Non espandere se si clicca sulla checkbox
            
            const isExpanded = layerElements.classList.contains('expanded');
            layerElements.classList.toggle('expanded');
            layerHeader.classList.toggle('expanded');
            layerToggle.classList.toggle('expanded');
        });
        
        layerNode.appendChild(layerHeader);
        layerNode.appendChild(layerElements);
        
        return layerNode;
    }
    
    createElementItem(element) {
        const elementItem = document.createElement('div');
        elementItem.className = 'element-item';
        
        const elementName = document.createElement('span');
        elementName.className = 'element-name';
        elementName.textContent = element.name || 'Elemento senza nome';
        
        const elementActions = document.createElement('div');
        elementActions.className = 'element-actions';
        
        // Pulsante Focus
        const focusBtn = document.createElement('button');
        focusBtn.className = 'element-btn focus';
        focusBtn.textContent = '👁';
        focusBtn.title = 'Focalizza elemento';
        focusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.focusOnObject(element);
        });
        
        // Pulsante Evidenzia
        const highlightBtn = document.createElement('button');
        highlightBtn.className = 'element-btn highlight';
        highlightBtn.textContent = '💡';
        highlightBtn.title = 'Evidenzia elemento';
        highlightBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.highlightObject(element);
        });
        
        elementActions.appendChild(focusBtn);
        elementActions.appendChild(highlightBtn);
        
        elementItem.appendChild(elementName);
        elementItem.appendChild(elementActions);
        
        // Click sull'elemento per selezionarlo
        elementItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('element-btn')) return;
            this.selectObject(element);
        });
        
        return elementItem;
    }
    
    init() {
        // Inizializza flag per le ottimizzazioni
        this.modelSizeMB = 0;
        this.largeModelOptimizationsApplied = false;
        this.criticalModelOptimizationsApplied = false;
        this.highMemoryOptimizationsApplied = false;
        this.emergencyOptimizationsApplied = false;
        this.smallScreenOptimizationsApplied = false;
        this.lowQualityRendering = false;
        this.currentModel = null;
        
        // Carica la preferenza del tema dal localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.isDarkBackground = savedTheme === 'dark';
        }
        
        // Setup scene
        this.scene = new THREE.Scene();
        // Imposta il background in base alla preferenza
        this.scene.background = new THREE.Color(this.isDarkBackground ? 0x222222 : 0xf0f0f0);
        
        // Setup camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(5, 5, 5);
        
        // Rileva capacità del dispositivo
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEndDevice = isMobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
        
        // Setup renderer con ottimizzazioni automatiche
        const canvas = document.getElementById('three-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: !isLowEndDevice, // Disabilita antialiasing su dispositivi a basse prestazioni
            alpha: true,
            powerPreference: 'high-performance', // Richiedi GPU ad alte prestazioni se disponibile
            precision: isLowEndDevice ? 'mediump' : 'highp' // Usa precisione media su dispositivi a basse prestazioni
        });
        
        // Configura dimensioni e pixel ratio in base al dispositivo
        const header = document.querySelector('header');
        const controls = document.getElementById('controls');
        const headerHeight = header ? header.offsetHeight : 0;
        const controlsHeight = controls ? controls.offsetHeight : 0;
        const availableHeight = window.innerHeight - headerHeight - controlsHeight;
        
        this.renderer.setSize(window.innerWidth, availableHeight);
        
        // Limita il pixel ratio su dispositivi a basse prestazioni
        const maxPixelRatio = isLowEndDevice ? 1.0 : 2.0;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
        
        // Configura le ombre in base alle capacità del dispositivo
        this.renderer.shadowMap.enabled = !isLowEndDevice;
        this.renderer.shadowMap.type = isLowEndDevice ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        
        // Configura encoding e tone mapping
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        // Abilita il culling aggressivo per impostazione predefinita
        this.renderer.sortObjects = true;
        
        // Setup controls con ottimizzazioni per dispositivi mobili
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = !isLowEndDevice; // Disabilita damping su dispositivi a basse prestazioni
        this.controls.dampingFactor = isLowEndDevice ? 0.1 : 0.05; // Damping più aggressivo su dispositivi a basse prestazioni
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.enableRotate = true;
        
        // Touch-friendly settings
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        
        // Configura intervallo di controllo memoria per dispositivi a basse prestazioni
        this.memoryCheckInterval = isLowEndDevice ? 10000 : 5000; // 10 secondi per dispositivi a basse prestazioni, 5 secondi per altri
        
        // Setup raycaster for clickable objects
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Setup lighting
        this.setupLighting();
        
        // Start render loop
        this.animate();
        
        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Add event listeners for clickable objects
        this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this), false);
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Point light
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-10, 10, -10);
        this.scene.add(pointLight);
        
        // Hemisphere light
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
        this.scene.add(hemisphereLight);
    }
    
    setupEventListeners() {
        // Definiamo fileInput come proprietà della classe per accedervi da altri metodi
        this.fileInput = document.getElementById('fileInput');
        
        // Gestione dei nuovi menu dropdown
        const uploadModelBtn = document.getElementById('uploadModelBtn');
        const engineModelBtn = document.getElementById('engineModelBtn');
        // Rimossa dichiarazione s3ModelBtn
        const resetViewBtn = document.getElementById('resetViewBtn');
        const wireframeBtn = document.getElementById('wireframeBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // Debug: Verifica elementi DOM all'avvio
        console.log('DOM Elements Check:');
        console.log('- loadButton:', document.getElementById('loadButton'));
        console.log('- settingsButton:', document.getElementById('settingsButton'));
        console.log('- loadModelItems:', document.getElementById('loadModelItems'));
        console.log('- settingsItems:', document.getElementById('settingsItems'));
        
        // Implementazione semplificata dei menu
        // Funzione per chiudere tutti i menu
        const closeAllMenus = () => {
            console.log('Chiusura di tutti i menu');
            document.querySelectorAll('.menu-items').forEach(menu => {
                menu.classList.remove('show');
            });
        };
        
        // Gestione menu "Carica Modello"
        const loadModelBtn = document.getElementById('loadButton');
        const loadModelItems = document.getElementById('loadModelItems');
        
        if (loadModelBtn && loadModelItems) {
            console.log('Configurazione menu Carica Modello');
            
            // Gestione click sul pulsante principale
            loadModelBtn.onclick = function(e) {
                console.log('CLICK su Carica Modello');
                e.stopPropagation();
                
                // Chiudi tutti gli altri menu
                document.querySelectorAll('.menu-items').forEach(menu => {
                    if (menu !== loadModelItems) {
                        menu.classList.remove('show');
                    }
                });
                
                // Apri/chiudi questo menu
                loadModelItems.classList.toggle('show');
                console.log('Menu Carica Modello cliccato, Stato:', loadModelItems.classList.contains('show'));
            };
            
            // Previeni la chiusura quando si clicca all'interno del menu
            loadModelItems.onclick = function(e) {
                console.log('Click dentro loadModelItems');
                e.stopPropagation();
            };
            
            // Configura i pulsanti del menu
            const uploadModelBtn = document.getElementById('uploadModelBtn');
            
            if (uploadModelBtn) {
                uploadModelBtn.onclick = (e) => {
                    console.log('Click su Carica File');
                    e.stopPropagation();
                    this.fileInput.click();
                    closeAllMenus();
                };
            }
            
            // Carica dinamicamente i modelli dalla cartella compressor/output
            this.loadDynamicModels();
            
            // Rimosso gestore eventi per il pulsante S3
        } else {
            console.error('Elementi menu Carica Modello non trovati');
        }
        
        // Gestione menu "Impostazioni"
        const settingsBtn = document.getElementById('settingsButton');
        const settingsItems = document.getElementById('settingsItems');
        
        if (settingsBtn && settingsItems) {
            console.log('Configurazione menu Impostazioni');
            
            // Gestione click sul pulsante principale
            settingsBtn.onclick = function(e) {
                console.log('CLICK su Impostazioni');
                e.stopPropagation();
                
                // Chiudi tutti gli altri menu
                document.querySelectorAll('.menu-items').forEach(menu => {
                    if (menu !== settingsItems) {
                        menu.classList.remove('show');
                    }
                });
                
                // Apri/chiudi questo menu
                settingsItems.classList.toggle('show');
                console.log('Menu Impostazioni cliccato, Stato:', settingsItems.classList.contains('show'));
            };
            
            // Previeni la chiusura quando si clicca all'interno del menu
            settingsItems.onclick = function(e) {
                console.log('Click dentro settingsItems');
                e.stopPropagation();
            };
            
            // Configura i pulsanti del menu
            const resetViewBtn = document.getElementById('resetViewBtn');
            const wireframeBtn = document.getElementById('wireframeBtn');
            const fullscreenBtn = document.getElementById('fullscreenBtn');
            const backgroundBtn = document.getElementById('backgroundBtn');
            const optimizationsBtn = document.getElementById('optimizationsBtn');
            
            if (resetViewBtn) {
                resetViewBtn.onclick = function(e) {
                    console.log('Click su Reset Vista');
                    e.stopPropagation();
                    resetView();
                    closeAllMenus();
                };
            }
            
            // Gestione del pulsante Refresh (Svuota Visualizzatore)
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                refreshBtn.onclick = (e) => {
                    console.log('Click su Svuota Visualizzatore');
                    e.stopPropagation();
                    this.clearScene();
                    closeAllMenus();
                };
            }
            
            if (wireframeBtn) {
                wireframeBtn.onclick = function(e) {
                    console.log('Click su Wireframe');
                    e.stopPropagation();
                    toggleWireframe();
                    closeAllMenus();
                };
            }
            
            if (fullscreenBtn) {
                fullscreenBtn.onclick = function(e) {
                    console.log('Click su Schermo Intero');
                    e.stopPropagation();
                    toggleFullscreen();
                    closeAllMenus();
                };
            }
            
            if (backgroundBtn) {
                // Inizializza il testo del pulsante in base al tema corrente
                backgroundBtn.textContent = this.isDarkBackground ? 'Sfondo Chiaro' : 'Sfondo Scuro';
                
                backgroundBtn.onclick = (e) => {
                    console.log('Click su Cambio Sfondo');
                    e.stopPropagation();
                    this.toggleBackground();
                    closeAllMenus();
                };
            }
            
            if (optimizationsBtn) {
                optimizationsBtn.onclick = (e) => {
                    console.log('Click su Ottimizzazioni');
                    e.stopPropagation();
                    if (this.aggressiveOptimizationsEnabled) {
                        this.disableAggressiveOptimizations();
                        optimizationsBtn.textContent = 'Abilita Ottimizzazioni';
                        alert('Ottimizzazioni aggressive disabilitate. Gli oggetti nascosti sono stati ripristinati.');
                    } else {
                        this.enableAggressiveOptimizations();
                        optimizationsBtn.textContent = 'Disabilita Ottimizzazioni';
                        alert('Ottimizzazioni aggressive riabilitate.');
                    }
                    closeAllMenus();
                };
            }
            
            // Gestione del pulsante Statistiche Modello
            const modelStatsBtn = document.getElementById('modelStatsBtn');
            if (modelStatsBtn) {
                modelStatsBtn.onclick = (e) => {
                    console.log('Click su Statistiche Modello');
                    e.stopPropagation();
                    this.showModelStatistics();
                    closeAllMenus();
                };
            }
        } else {
            console.error('Elementi menu Impostazioni non trovati');
        }
        
        // Gestione menu "Gerarchia"
        const hierarchyBtn = document.getElementById('hierarchyButton');
        const hierarchyItems = document.getElementById('hierarchyItems');
        
        if (hierarchyBtn && hierarchyItems) {
            console.log('Configurazione menu Gerarchia');
            
            // Gestione click sul pulsante principale
            hierarchyBtn.onclick = function(e) {
                console.log('CLICK su Gerarchia');
                e.stopPropagation();
                
                // Chiudi tutti gli altri menu
                document.querySelectorAll('.menu-items').forEach(menu => {
                    if (menu !== hierarchyItems) {
                        menu.classList.remove('show');
                    }
                });
                
                // Apri/chiudi questo menu
                hierarchyItems.classList.toggle('show');
                console.log('Menu Gerarchia cliccato, Stato:', hierarchyItems.classList.contains('show'));
            };
            
            // Previeni la chiusura quando si clicca all'interno del menu
            hierarchyItems.onclick = function(e) {
                console.log('Click dentro hierarchyItems');
                e.stopPropagation();
            };
        } else {
            console.error('Elementi menu Gerarchia non trovati');
        }
        
        // Chiudi i menu quando si clicca altrove
        document.onclick = function(e) {
            console.log('Click sul documento');
            closeAllMenus();
        };
        
        // Carica file - Gestore già definito in precedenza
        // uploadModelBtn.addEventListener('click', (e) => {
        //     e.preventDefault();
        //     fileInput.click();
        // });
        
        // Modello test - Gestore già definito in precedenza
        // testModelBtn.addEventListener('click', (e) => {
        //     e.preventDefault();
        //     // Carica il modello test e lo rende cliccabile di default
        //     this.loadTestModel();
        //     // Aggiungi un breve ritardo per assicurarsi che il modello sia caricato
        //     setTimeout(() => {
        //         if (this.currentModel) {
        //             this.createClickableTestModel();
        //         }
        //     }, 100);
        // });
        
        // Motore V8 - Gestore già definito in precedenza
        // engineModelBtn.addEventListener('click', (e) => {
        //     e.preventDefault();
        //     this.loadExampleGlbModel();
        // });
        
        // Carica da S3 - Gestore già definito in precedenza
        // s3ModelBtn.addEventListener('click', (e) => {
        //     e.preventDefault();
        //     this.openS3ModelDialog();
        // });
        
        // Rimosso codice per la gestione del dialogo S3
        
        // Rimosso codice per la gestione dei pulsanti di caricamento modelli S3
        
        // Gestione del caricamento modello personalizzato da S3
        const s3ModelCustomLoadBtn = document.getElementById('s3-model-custom-load-btn');
        const s3ModelCustomInput = document.getElementById('s3-model-custom-input');
        
        if (s3ModelCustomLoadBtn && s3ModelCustomInput) {
            s3ModelCustomLoadBtn.addEventListener('click', () => {
                const modelName = s3ModelCustomInput.value.trim();
                if (modelName) {
                    this.loadS3Model(modelName);
                    if (s3ModelDialog) {
                        s3ModelDialog.classList.add('hidden');
                    }
                } else {
                    alert('Inserisci un nome di file valido.');
                }
            });
        } else {
             console.warn('Elementi per il caricamento del modello personalizzato da S3 non trovati');
         }
        
        // Reset vista
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetView();
            });
        } else {
            console.warn('Pulsante Reset Vista non trovato');
        }
        
        // Wireframe
        if (wireframeBtn) {
            wireframeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleWireframe();
            });
        } else {
            console.warn('Pulsante Wireframe non trovato');
        }
        
        // Schermo intero
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFullscreen();
            });
        } else {
            console.warn('Pulsante Schermo Intero non trovato');
        }
        
        // Gestione del caricamento file
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                // Previeni caricamenti simultanei
                if (this.isLoading) {
                    console.warn('Caricamento già in corso. Attendere il completamento.');
                    alert('Caricamento già in corso. Attendere il completamento o utilizzare il pulsante "Svuota Visualizzatore" per annullare.');
                    return;
                }
                
                console.log('File selezionato:', file.name);
                
                const fileName = file.name.toLowerCase();
                console.log('Elaborazione file:', fileName);
                
                // Imposta il flag di caricamento
                this.isLoading = true;
                
                // Aggiorna lo stato del pulsante di caricamento
                this.updateUploadButtonState();
                
                if (fileName.endsWith('.fbx')) {
                     this.loadFBXModel(file);
                 } else if (fileName.endsWith('.obj')) {
                     this.loadOBJModel(file);
                 } else if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
                     this.loadGLTFModel(file);
                 } else {
                     alert('Per favore seleziona un file 3D valido (.fbx, .obj, .gltf, .glb).');
                     this.isLoading = false; // Reimposta il flag se il file non è valido
                     this.updateUploadButtonState(); // Aggiorna lo stato del pulsante
                 }
            });
        } else {
            console.warn('Input file non trovato');
        }
    }
    

    
    // Metodo comune per preparare il caricamento di qualsiasi modello 3D
    prepareModelLoading(file) {
        console.log('Inizio prepareModelLoading per file:', file.name);
        const loading = document.getElementById('loading');
        const instructions = document.getElementById('instructions');
        
        console.log('Elementi DOM:', { loading, instructions });
        
        // Check file size
        const fileSizeMB = file.size / (1024 * 1024);
        console.log(`Dimensione file: ${fileSizeMB.toFixed(2)} MB`);
        
        if (fileSizeMB > 100) {
            const proceed = confirm(`Il file è molto grande (${fileSizeMB.toFixed(2)} MB). Il caricamento potrebbe richiedere diversi minuti e consumare molta memoria. Continuare?\n\nNota: Il limite massimo è 500MB.`);
            if (!proceed) {
                console.log('Utente ha annullato il caricamento del file grande');
                this.isLoading = false; // Reimposta il flag di caricamento se l'utente annulla
                this.updateUploadButtonState(); // Aggiorna lo stato del pulsante
                return null;
            }
        }
        
        if (fileSizeMB > 500) {
            alert(`File troppo grande (${fileSizeMB.toFixed(2)} MB). Il limite massimo è 500MB. Si consiglia di utilizzare file sotto i 100MB per prestazioni ottimali su dispositivi mobili.`);
            console.log('File troppo grande, caricamento annullato');
            this.isLoading = false; // Reimposta il flag di caricamento se il file è troppo grande
            this.updateUploadButtonState(); // Aggiorna lo stato del pulsante
            return null;
        }
        
        console.log('Mostrando il loader e nascondendo le istruzioni');
        loading.classList.remove('hidden');
        instructions.style.display = 'none';
        
        // Add progress info
        const loadingText = loading.querySelector('p');
        console.log('Elemento loadingText:', loadingText);
        loadingText.innerHTML = `Caricamento modello...<br><small>${fileSizeMB.toFixed(2)} MB</small>`;
        
        // Remove existing model
        if (this.currentModel) {
            console.log('Rimuovendo il modello esistente');
            this.scene.remove(this.currentModel);
        }
        
        // Add progress bar
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 80%;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            margin: 10px auto;
            overflow: hidden;
        `;
        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: #D4AF37;
            transition: width 0.3s ease;
        `;
        progressBar.appendChild(progressFill);
        loading.appendChild(progressBar);
        
        return {
            loading,
            instructions,
            loadingText,
            progressBar,
            progressFill,
            fileSizeMB
        };
    }
    
    // Metodo comune per processare un modello 3D dopo il caricamento
    processLoadedModel(object, loadingInfo, url, loadingTimeout, modelType) {
        console.log('Inizio processLoadedModel con oggetto:', object);
        console.log('Tipo di modello:', modelType);
        
        if (!loadingInfo) {
            console.error('loadingInfo è null in processLoadedModel');
            return;
        }
        
        const { loading, instructions, loadingText, progressBar, progressFill, fileSizeMB } = loadingInfo;
        console.log('Elementi estratti da loadingInfo:', { loading, instructions, loadingText, progressBar, progressFill, fileSizeMB });
        
        clearTimeout(loadingTimeout);
        this.currentModel = object;
        console.log('currentModel impostato:', this.currentModel);
        
        // Resetta la lista degli oggetti cliccabili quando si carica un nuovo modello
        this.clickableObjects = [];
        
        // Update loading text to show processing
        console.log('Aggiornamento testo di caricamento per processamento');
        loadingText.innerHTML = `Processamento modello 3D...<br><small>Calcolo geometria e materiali</small>`;
        progressFill.style.width = '100%';
        
        // Assicurati che il loader sia visibile durante il processamento
        if (loading.classList.contains('hidden')) {
            loading.classList.remove('hidden');
            console.log('Loader reso visibile durante il processamento');
        }
        
        // Use setTimeout to allow UI update before heavy processing
        setTimeout(() => {
            // Scale and center the model
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
        
            // Scale to fit in view
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 5 / maxDim;
            object.scale.setScalar(scale);
            
            // Center the object
            object.position.sub(center.multiplyScalar(scale));
            
            // Optimize for large models with progressive enhancements based on file size
            console.log('Applicando ottimizzazioni per modello, dimensione:', fileSizeMB, 'MB');
            
            // Salva la dimensione del modello per riferimento futuro
            this.modelSizeMB = fileSizeMB || 0;
            
            // Determina il livello di ottimizzazione in base alla dimensione del file
            const isLargeModel = fileSizeMB > 50;
            const isVeryLargeModel = fileSizeMB > 100;
            const isCriticalModel = fileSizeMB > 300;
            
            // Applica ottimizzazioni preventive basate sulla dimensione del modello
            if (isCriticalModel) {
                console.warn('Modello critico (>300MB) rilevato. Applicando ottimizzazioni preventive...');
                this.applyCriticalModelOptimizations();
                this.criticalOptimizationsApplied = true;
            } else if (isVeryLargeModel) {
                console.warn('Modello molto grande (>100MB) rilevato. Applicando ottimizzazioni preventive...');
                this.applyLargeModelOptimizations();
                this.largeModelOptimizationsApplied = true;
            } else if (isLargeModel) {
                // Ottimizzazioni progressive per tutti i modelli
                object.traverse((child) => {
                    if (child.isMesh) {
                        // Ottimizzazioni di base per tutti i modelli
                        if (child.material) {
                            // Ottimizza le texture
                            if (child.material.map) {
                                child.material.map.minFilter = THREE.LinearFilter;
                                child.material.map.magFilter = THREE.LinearFilter;
                            }
                            
                            // Disabilita caratteristiche non necessarie per modelli grandi
                            child.material.transparent = false;
                            child.castShadow = false;
                            child.receiveShadow = false;
                            
                            // Forza l'aggiornamento del materiale
                            child.material.needsUpdate = true;
                        }
                        
                        // Abilita frustum culling per tutti i modelli grandi
                        child.frustumCulled = true;
                    }
                });
            }
            
            // Implementa ottimizzazioni di memoria per modelli grandi
            if (isLargeModel) {
                // Implementa un sistema di gestione della memoria
                console.log('Implementando sistema di gestione della memoria...');
                
                // Imposta un timer per controllare periodicamente l'uso della memoria
                this.memoryCheckInterval = setInterval(() => {
                    if ('memory' in performance) {
                        const memInfo = performance.memory;
                        const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
                        const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
                        const usagePercent = (usedMB / limitMB) * 100;
                        
                        // Se l'uso della memoria è critico, applica ottimizzazioni di emergenza
                        if (usagePercent > 90 && !this.emergencyOptimizationsApplied) {
                            console.warn(`Memoria critica: ${usagePercent.toFixed(1)}% utilizzata. Applicando ottimizzazioni di emergenza...`);
                            this.applyEmergencyOptimizations();
                            this.emergencyOptimizationsApplied = true;
                        }
                    }
                }, 10000); // Controlla ogni 10 secondi
            }
            
            // Implementa ottimizzazioni di rendering per modelli grandi
            if (isVeryLargeModel) {
                // Riduci la qualità del renderer
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
                
                // Usa shadow map più semplici
                this.renderer.shadowMap.type = THREE.BasicShadowMap;
            }
            
            // Implementa ottimizzazioni drastiche per modelli critici
            if (isCriticalModel) {
                // Riduci drasticamente la qualità del renderer
                this.renderer.setPixelRatio(1);
                this.renderer.shadowMap.enabled = false;
                this.lowQualityRendering = true;
                
                // Implementa LOD per modelli critici (solo se le ottimizzazioni aggressive sono abilitate)
                if (this.aggressiveOptimizationsEnabled) {
                    console.log('Implementando Level of Detail (LOD) per modello critico...');
                    this.setupSimpleLOD(object);
                }
            }
            
            // Enable shadows and prepare for clickable objects
            let meshCount = 0;
            object.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Ensure materials are properly set up
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                mat.needsUpdate = true;
                            });
                        } else {
                            child.material.needsUpdate = true;
                        }
                    }
                    
                    // Assegna un nome se non ne ha uno
                    if (!child.name) {
                        child.name = `mesh_${meshCount++}`;
                    }
                    
                    // Aggiungi informazioni sul tipo di geometria nei userData per facilitare la selezione
                    if (child.geometry) {
                        if (child.geometry instanceof THREE.BoxGeometry) {
                            child.userData.geometryType = 'box';
                        } else if (child.geometry instanceof THREE.SphereGeometry) {
                            child.userData.geometryType = 'sphere';
                        } else if (child.geometry instanceof THREE.CylinderGeometry) {
                            child.userData.geometryType = 'cylinder';
                        } else if (child.geometry instanceof THREE.PlaneGeometry) {
                            child.userData.geometryType = 'plane';
                        } else {
                            child.userData.geometryType = child.geometry.type;
                        }
                    }
                }
            });
            
            console.log('Aggiungendo il modello alla scena:', object);
            this.scene.add(object);
            console.log('Modello aggiunto alla scena, oggetti nella scena:', this.scene.children.length);
            
            // Crea i layer dal modello caricato
            console.log('Creazione layer dal modello...');
            this.createLayersFromModel(object);
            
            // Reset camera position
            console.log('Resettando la vista della camera');
            this.resetView();
            
            console.log('Nascondendo il loader...');
            loading.classList.add('hidden');
            console.log('Loader nascosto:', loading.classList.contains('hidden'));
            console.log('Mostrando le istruzioni');
            instructions.style.display = 'block';
            
            // Clean up progress bar and URL
            console.log('Pulizia elementi UI');
            if (progressBar.parentNode) {
                progressBar.parentNode.removeChild(progressBar);
                console.log('Progress bar rimossa');
            }
            console.log('Revoca URL oggetto:', url);
            URL.revokeObjectURL(url);
            
            console.log(`Modello ${modelType} caricato con successo!`);
            
            // Check memory usage
            console.log('Controllo utilizzo memoria');
            this.checkMemoryUsage(fileSizeMB);
            
            // Reset loading text
            console.log('Reset testo di caricamento');
            loadingText.innerHTML = 'Caricamento modello...';
            
            // Verifica che il loader sia effettivamente nascosto
            setTimeout(() => {
                const loaderElement = document.getElementById('loading');
                if (loaderElement && !loaderElement.classList.contains('hidden')) {
                    console.error('Il loader è ancora visibile dopo il caricamento!');
                    loaderElement.classList.add('hidden');
                }
            }, 1000);
            
            // Aggiungi la variabile viewer all'oggetto window per consentire l'accesso dalla console
            window.viewer = this;
            
            // Rendi automaticamente cliccabili gli elementi del modello (massimo 50)
            setTimeout(() => {
                if (this.currentModel) {
                    // Rendi cliccabili le parti del modello (limitato a 50 elementi)
                    const maxClickableElements = 500;
                    this.makeModelPartsClickable(
                        {}, // Nessun criterio specifico, rendi cliccabili tutti gli oggetti mesh
                        (obj) => {
                            // Quando l'utente clicca su una parte, mostra il nome
                            alert(`Hai cliccato su: ${obj.name}`);
                            // Cambia colore quando viene cliccato
                            if (obj.material) {
                                obj.material.color.set(Math.random() * 0xffffff);
                            }
                        },
                        'Clicca per interagire con {name}',
                        maxClickableElements
                    );
                    // Elementi cliccabili creati senza mostrare messaggi
                }
            }, 500);
            
            // Resetta il flag di caricamento
            this.isLoading = false;
            
            // Aggiorna lo stato del pulsante di caricamento
            this.updateUploadButtonState();
            
            // Il messaggio "modello caricato con successo" è stato rimosso
        }, 100); // Small delay to allow UI update
    }
    
    // Metodo comune per gestire gli errori di caricamento
    handleLoadingError(error, loadingInfo, url, loadingTimeout, modelType) {
        const { loading, instructions, loadingText, progressBar } = loadingInfo;
        
        clearTimeout(loadingTimeout);
        console.error(`Errore durante il caricamento del modello ${modelType}:`, error);
        console.log('Nascondendo il loader dopo errore...');
        loading.classList.add('hidden');
        console.log('Loader nascosto dopo errore:', loading.classList.contains('hidden'));
        instructions.style.display = 'block';
        
        // Verifica che il loader sia effettivamente nascosto
        setTimeout(() => {
            const loaderElement = document.getElementById('loading');
            if (loaderElement && !loaderElement.classList.contains('hidden')) {
                console.error('Il loader è ancora visibile dopo l\'errore!');
                loaderElement.classList.add('hidden');
            }
        }, 1000);
        
        // Mostra messaggio di errore più informativo
        const loaderName = `${modelType}Loader`;
        const errorMsg = error.message.includes(`${loaderName} non disponibile`) 
            ? `${loaderName} non disponibile. Prova il "Modello Test" per vedere la demo.`
            : `Errore nel caricamento del modello ${modelType}. Verifica che il file sia valido.`;
                
        alert(errorMsg);
        
        // Resetta il flag di caricamento
        this.isLoading = false;
        
        // Aggiorna lo stato del pulsante di caricamento
        this.updateUploadButtonState();
        
        // Clean up progress bar and URL
        if (progressBar.parentNode) {
            progressBar.parentNode.removeChild(progressBar);
        }
        URL.revokeObjectURL(url);
        
        // Reset loading text
        loadingText.innerHTML = 'Caricamento modello...';
        
        // Se il loader non è disponibile, mostra un messaggio di errore
        if (error.message.includes(`${loaderName} non disponibile`)) {
            setTimeout(() => {
                alert('Loader non disponibile. Prova con un formato di file diverso.');
            }, 500);
        }
    }
    
    // Metodo comune per gestire il progresso del caricamento
    handleLoadingProgress(progress, loadingInfo) {
        const { loadingText, progressFill } = loadingInfo;
        
        if (progress.lengthComputable) {
            const percentComplete = (progress.loaded / progress.total) * 100;
            console.log(`Progresso caricamento: ${percentComplete.toFixed(1)}%`);
            
            // Update progress bar
            progressFill.style.width = percentComplete + '%';
            
            // Update loading text with detailed info
            const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
            const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
            loadingText.innerHTML = `
                Caricamento modello...<br>
                <small>${loadedMB}MB / ${totalMB}MB (${percentComplete.toFixed(1)}%)</small>
            `;
            
            // Assicurati che il loader sia visibile
            const loading = document.getElementById('loading');
            if (loading && loading.classList.contains('hidden')) {
                loading.classList.remove('hidden');
                console.log('Loader reso visibile durante il caricamento');
            }
        } else {
            // Fallback for non-computable progress
            const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
            loadingText.innerHTML = `
                Caricamento modello...<br>
                <small>${loadedMB}MB caricati...</small>
            `;
        }
    }
    
    loadFBXModel(file) {
        const loadingInfo = this.prepareModelLoading(file);
        if (!loadingInfo) return;
        
        const url = URL.createObjectURL(file);
        
        // Add timeout for loading
        const loadingTimeout = setTimeout(() => {
            console.warn('Timeout caricamento - il file potrebbe essere troppo complesso');
            console.log('Nascondendo il loader dopo timeout...');
            loadingInfo.loading.classList.add('hidden');
            console.log('Loader nascosto dopo timeout:', loadingInfo.loading.classList.contains('hidden'));
            loadingInfo.instructions.style.display = 'block';
            
            // Verifica che il loader sia effettivamente nascosto
            setTimeout(() => {
                const loaderElement = document.getElementById('loading');
                if (loaderElement && !loaderElement.classList.contains('hidden')) {
                    console.error('Il loader è ancora visibile dopo il timeout!');
                    loaderElement.classList.add('hidden');
                }
            }, 1000);
            if (loadingInfo.progressBar.parentNode) {
                loadingInfo.progressBar.parentNode.removeChild(loadingInfo.progressBar);
            }
            loadingInfo.loadingText.innerHTML = 'Caricamento modello...';
            URL.revokeObjectURL(url);
            alert('Timeout durante il caricamento. Il file potrebbe essere troppo complesso o corrotto.');
        }, 120000); // 2 minuti timeout
        
        const loader = new THREE.FBXLoader();
        loader.load(
            url,
            (object) => this.processLoadedModel(object, loadingInfo, url, loadingTimeout, 'FBX'),
            (progress) => this.handleLoadingProgress(progress, loadingInfo),
            (error) => this.handleLoadingError(error, loadingInfo, url, loadingTimeout, 'FBX')
        );
    }
    
    loadOBJModel(file) {
        console.log('Caricamento file OBJ:', file.name);
        const loadingInfo = this.prepareModelLoading(file);
        if (!loadingInfo) return;
        
        const url = URL.createObjectURL(file);
        
        // Add timeout for loading
        const loadingTimeout = setTimeout(() => {
            console.warn('Timeout caricamento - il file potrebbe essere troppo complesso');
            loadingInfo.loading.classList.add('hidden');
            loadingInfo.instructions.style.display = 'block';
            if (loadingInfo.progressBar.parentNode) {
                loadingInfo.progressBar.parentNode.removeChild(loadingInfo.progressBar);
            }
            loadingInfo.loadingText.innerHTML = 'Caricamento modello...';
            URL.revokeObjectURL(url);
            alert('Timeout durante il caricamento. Il file potrebbe essere troppo complesso o corrotto.');
        }, 120000); // 2 minuti timeout
        
        try {
            console.log('Inizializzazione OBJLoader...');
            const loader = new THREE.OBJLoader();
            console.log('OBJLoader inizializzato con successo');
            
            loader.load(
                url,
                (object) => {
                    console.log('OBJ caricato con successo:', object);
                    this.processLoadedModel(object, loadingInfo, url, loadingTimeout, 'OBJ');
                },
                (progress) => this.handleLoadingProgress(progress, loadingInfo),
                (error) => {
                    console.error('Errore specifico OBJLoader:', error);
                    this.handleLoadingError(error, loadingInfo, url, loadingTimeout, 'OBJ');
                }
            );
        } catch (e) {
            console.error('Errore durante l\'inizializzazione di OBJLoader:', e);
            alert('Errore durante l\'inizializzazione di OBJLoader: ' + e.message);
            loadingInfo.loading.classList.add('hidden');
            loadingInfo.instructions.style.display = 'block';
        }
    }
    
    loadGLTFModel(file) {
        console.log('Caricamento file GLTF/GLB:', file.name);
        const loadingInfo = this.prepareModelLoading(file);
        console.log('loadingInfo:', loadingInfo);
        if (!loadingInfo) {
            console.error('loadingInfo è null, uscita dal metodo loadGLTFModel');
            return;
        }
        
        const url = URL.createObjectURL(file);
        console.log('URL creato:', url);
        
        // Add timeout for loading
        const loadingTimeout = setTimeout(() => {
            console.warn('Timeout caricamento - il file potrebbe essere troppo complesso');
            loadingInfo.loading.classList.add('hidden');
            loadingInfo.instructions.style.display = 'block';
            if (loadingInfo.progressBar.parentNode) {
                loadingInfo.progressBar.parentNode.removeChild(loadingInfo.progressBar);
            }
            loadingInfo.loadingText.innerHTML = 'Caricamento modello...';
            URL.revokeObjectURL(url);
            alert('Timeout durante il caricamento. Il file potrebbe essere troppo complesso o corrotto.');
        }, 120000); // 2 minuti timeout
        
        try {
            console.log('Inizializzazione GLTFLoader con DRACOLoader...');
            const loader = new THREE.GLTFLoader();
            
            // Configurazione DRACOLoader per ottimizzazione mobile
            const dracoLoader = new THREE.DRACOLoader();
            // Imposta il percorso per i file del decoder Draco
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
            // Usa WebAssembly di default per prestazioni migliori
            dracoLoader.setDecoderConfig({ type: 'wasm' });
            // Collega DRACOLoader a GLTFLoader
            loader.setDRACOLoader(dracoLoader);
            
            console.log('GLTFLoader con DRACOLoader inizializzato con successo');
            
            loader.load(
                url,
                (gltf) => {
                    console.log('GLTF/GLB caricato con successo:', gltf);
                    // GLTF loader returns a different structure than FBX and OBJ loaders
                    const object = gltf.scene || gltf.scenes[0];
                    console.log('Oggetto estratto da gltf:', object);
                    
                    // Rileva se il modello è compresso
                    this.isCurrentModelCompressed = this.detectDracoCompression(gltf);
                    console.log('Modello compresso rilevato:', this.isCurrentModelCompressed);
                    
                    this.processLoadedModel(object, loadingInfo, url, loadingTimeout, 'GLTF/GLB');
                    // Rilascia la memoria del decoder quando non è più necessario
                    dracoLoader.dispose();
                },
                (progress) => this.handleLoadingProgress(progress, loadingInfo),
                (error) => {
                    console.error('Errore specifico GLTFLoader:', error);
                    this.handleLoadingError(error, loadingInfo, url, loadingTimeout, 'GLTF/GLB');
                    // Rilascia la memoria del decoder in caso di errore
                    dracoLoader.dispose();
                }
            );
        } catch (e) {
            console.error('Errore durante l\'inizializzazione di GLTFLoader:', e);
            alert('Errore durante l\'inizializzazione di GLTFLoader: ' + e.message);
            loadingInfo.loading.classList.add('hidden');
            loadingInfo.instructions.style.display = 'block';
        }
    }
    
    async loadExampleGlbModel() {
        const loading = document.getElementById('loading');
        const instructions = document.getElementById('instructions');
        
        loading.classList.remove('hidden');
        instructions.style.display = 'none';
        
        // Crea un oggetto di informazioni di caricamento simulato
        const loadingText = loading.querySelector('p');
        loadingText.innerHTML = 'Caricamento modello Motore V8...';
        
        // Aggiungi progress bar
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 80%;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            margin: 10px auto;
            overflow: hidden;
        `;
        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: #D4AF37;
            transition: width 0.3s ease;
        `;
        progressBar.appendChild(progressFill);
        loading.appendChild(progressBar);
        
        // Remove existing model
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // Resetta la lista degli oggetti cliccabili quando si carica un nuovo modello
        this.clickableObjects = [];
        
        // Ottieni la dimensione reale del file
        let actualFileSizeMB = 5; // Fallback
        try {
            const response = await fetch('disassembled_v8_engine_block.glb', { method: 'HEAD' });
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                    actualFileSizeMB = parseInt(contentLength) / (1024 * 1024);
                }
            }
        } catch (error) {
            console.warn('Impossibile ottenere la dimensione del file, usando valore stimato:', error);
        }

        const loadingInfo = {
            loading,
            instructions,
            loadingText,
            progressBar,
            progressFill,
            fileSizeMB: actualFileSizeMB
        };
        
        // Add timeout for loading
        const loadingTimeout = setTimeout(() => {
            console.warn('Timeout caricamento - il file potrebbe essere troppo complesso');
            loading.classList.add('hidden');
            instructions.style.display = 'block';
            if (progressBar.parentNode) {
                progressBar.parentNode.removeChild(progressBar);
            }
            loadingText.innerHTML = 'Caricamento modello...';
            alert('Timeout durante il caricamento del modello di esempio.');
        }, 60000); // 1 minuto timeout
        
        try {
            console.log('Inizializzazione GLTFLoader con DRACOLoader per modello di esempio...');
            const loader = new THREE.GLTFLoader();
            
            // Configurazione DRACOLoader per ottimizzazione mobile
            const dracoLoader = new THREE.DRACOLoader();
            // Imposta il percorso per i file del decoder Draco
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
            // Usa WebAssembly di default per prestazioni migliori
            dracoLoader.setDecoderConfig({ type: 'wasm' });
            // Collega DRACOLoader a GLTFLoader
            loader.setDRACOLoader(dracoLoader);
            
            console.log('GLTFLoader con DRACOLoader inizializzato con successo');
            
            // Simula il progresso di caricamento
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 5;
                if (progress <= 100) {
                    progressFill.style.width = progress + '%';
                    loadingText.innerHTML = `
                        Caricamento modello Motore V8...<br>
                        <small>${(progress / 100 * loadingInfo.fileSizeMB).toFixed(1)}MB / ${loadingInfo.fileSizeMB.toFixed(1)}MB (${progress}%)</small>
                    `;
                } else {
                    clearInterval(progressInterval);
                }
            }, 100);
            
            loader.load(
                'disassembled_v8_engine_block.glb',
                (gltf) => {
                    console.log('Modello di esempio caricato con successo:', gltf);
                    clearInterval(progressInterval);
                    progressFill.style.width = '100%';
                    // GLTF loader returns a different structure than FBX and OBJ loaders
                    const object = gltf.scene || gltf.scenes[0];
                    
                    // Rileva se il modello è compresso (il motore V8 di esempio potrebbe essere compresso)
                    this.isCurrentModelCompressed = this.detectDracoCompression(gltf);
                    console.log('Modello compresso rilevato:', this.isCurrentModelCompressed);
                    
                    this.processLoadedModel(object, loadingInfo, null, loadingTimeout, 'Motore V8');
                    // Rilascia la memoria del decoder quando non è più necessario
                    dracoLoader.dispose();
                    
                    // Rendi il modello cliccabile dopo un breve ritardo per assicurarsi che sia completamente caricato
                    setTimeout(() => {
                        if (this.currentModel) {
                            // Rendi cliccabili le parti del motore (aumentato il limite da 50 a 500 elementi)
                            const maxClickableElements = 500;
                            this.makeModelPartsClickable(
                                {}, // Nessun criterio specifico, rendi cliccabili tutti gli oggetti mesh
                                (obj) => {
                                    // Quando l'utente clicca su una parte, sposta il focus su quell'elemento
                                    this.focusOnElement(obj);
                                    // Mostra il nome dell'elemento
                                    if (obj.name) {
                                        alert(`Elemento selezionato: ${obj.name}`);
                                    }
                                },
                                'Clicca per interagire con {name}',
                                maxClickableElements
                            );
                            // Elementi cliccabili creati senza mostrare messaggi
                        }
                    }, 500);
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        progressFill.style.width = percentComplete + '%';
                        const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
                        const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
                        loadingText.innerHTML = `
                            Caricamento modello Motore V8...<br>
                            <small>${loadedMB}MB / ${totalMB}MB (${percentComplete.toFixed(1)}%)</small>
                        `;
                    }
                },
                (error) => {
                    console.error('Errore nel caricamento del modello di esempio:', error);
                    clearInterval(progressInterval);
                    loading.classList.add('hidden');
                    instructions.style.display = 'block';
                    if (progressBar.parentNode) {
                        progressBar.parentNode.removeChild(progressBar);
                    }
                    loadingText.innerHTML = 'Caricamento modello...';
                    alert('Errore durante il caricamento del modello di esempio: ' + error.message);
                }
            );
        } catch (e) {
            console.error('Errore durante l\'inizializzazione di GLTFLoader:', e);
            clearTimeout(loadingTimeout);
            clearInterval(progressInterval);
            
            // Mostra un messaggio di errore dettagliato
            loadingText.innerHTML = `
                Errore di inizializzazione per ${modelName}<br>
                <small style="color: #f44336;">${e.message}</small><br>
                <small style="color: #D4AF37;">Verificare il supporto WebGL del browser</small>
            `;
            if (progressBar.parentNode) {
                progressFill.style.background = '#f44336';
            }
            
            // Nasconde il loader dopo 5 secondi
            setTimeout(() => {
                loading.classList.add('hidden');
                instructions.style.display = 'block';
                if (progressBar.parentNode) {
                    progressBar.parentNode.removeChild(progressBar);
                }
                loadingText.innerHTML = 'Caricamento modello...';
            }, 5000);
        }
    }
    
    async loadCompressorModel(filename) {
        const loading = document.getElementById('loading');
        const instructions = document.getElementById('instructions');
        
        loading.classList.remove('hidden');
        instructions.style.display = 'none';
        
        // Crea un oggetto di informazioni di caricamento simulato
        const loadingText = loading.querySelector('p');
        const modelName = filename.replace('.glb', '').replace(/[-_]/g, ' ');
        loadingText.innerHTML = `Caricamento modello ${modelName}...`;
        
        // Aggiungi progress bar
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 80%;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            margin: 10px auto;
            overflow: hidden;
        `;
        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: #D4AF37;
            transition: width 0.3s ease;
        `;
        progressBar.appendChild(progressFill);
        loading.appendChild(progressBar);
        
        // Remove existing model
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // Resetta la lista degli oggetti cliccabili quando si carica un nuovo modello
        this.clickableObjects = [];
        
        // Ottieni la dimensione reale del file
        let actualFileSizeMB = 10; // Fallback
        try {
            const response = await fetch(`compressor/output/${filename}`, { method: 'HEAD' });
            if (response.ok) {
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                    actualFileSizeMB = parseInt(contentLength) / (1024 * 1024);
                }
            }
        } catch (error) {
            console.warn('Impossibile ottenere la dimensione del file, usando valore stimato:', error);
        }

        const loadingInfo = {
            loading,
            instructions,
            loadingText,
            progressBar,
            progressFill,
            fileSizeMB: actualFileSizeMB
        };
        
        // Add timeout for loading (increased to 5 minutes for slow networks)
        const loadingTimeout = setTimeout(() => {
            console.warn('Timeout caricamento - rete lenta o file troppo complesso');
            // Non nascondere il loader, ma mostra un messaggio di timeout
            loadingText.innerHTML = `
                Timeout di rete rilevato per ${modelName}...<br>
                <small style="color: #ff9800;">La rete sembra lenta. Il caricamento continua in background.</small><br>
                <small style="color: #D4AF37;">Attendere ancora o ricaricare la pagina per riprovare.</small>
            `;
            // Cambia il colore della progress bar per indicare il timeout
            progressFill.style.background = '#ff9800';
            // Non nascondere il loader per far capire all'utente che sta ancora caricando
        }, 300000); // 5 minuti timeout
        
        try {
            console.log(`Inizializzazione GLTFLoader per modello: ${filename}`);
            const loader = new THREE.GLTFLoader();
            
            // Configurazione DRACOLoader per ottimizzazione mobile
            const dracoLoader = new THREE.DRACOLoader();
            // Imposta il percorso per i file del decoder Draco
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
            // Usa WebAssembly di default per prestazioni migliori
            dracoLoader.setDecoderConfig({ type: 'wasm' });
            // Collega DRACOLoader a GLTFLoader
            loader.setDRACOLoader(dracoLoader);
            
            console.log('GLTFLoader con DRACOLoader inizializzato con successo');
            
            // Simula il progresso di caricamento
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 5;
                if (progress <= 100) {
                    progressFill.style.width = progress + '%';
                    loadingText.innerHTML = `
                        Caricamento modello ${modelName}...<br>
                        <small>${(progress / 100 * loadingInfo.fileSizeMB).toFixed(1)}MB / ${loadingInfo.fileSizeMB.toFixed(1)}MB (${progress}%)</small>
                    `;
                } else {
                    clearInterval(progressInterval);
                }
            }, 100);
            
            loader.load(
                `compressor/output/${filename}`,
                (gltf) => {
                    console.log(`Modello ${filename} caricato con successo:`, gltf);
                    clearTimeout(loadingTimeout);
                    clearInterval(progressInterval);
                    progressFill.style.width = '100%';
                    // GLTF loader returns a different structure than FBX and OBJ loaders
                    const object = gltf.scene || gltf.scenes[0];
                    
                    // I modelli dalla cartella compressor/output sono sempre compressi
                    this.isCurrentModelCompressed = true;
                    console.log('Modello compresso dalla cartella compressor/output');
                    
                    this.processLoadedModel(object, loadingInfo, null, null, modelName);
                    // Rilascia la memoria del decoder quando non è più necessario
                    dracoLoader.dispose();
                    
                    // Rendi il modello cliccabile dopo un breve ritardo per assicurarsi che sia completamente caricato
                    setTimeout(() => {
                        if (this.currentModel) {
                            // Rendi cliccabili le parti del modello
                            const maxClickableElements = 500;
                            this.makeModelPartsClickable(
                                {}, // Nessun criterio specifico, rendi cliccabili tutti gli oggetti mesh
                                (obj) => {
                                    // Quando l'utente clicca su una parte, sposta il focus su quell'elemento
                                    this.focusOnElement(obj);
                                    // Mostra il nome dell'elemento
                                    if (obj.name) {
                                        alert(`Elemento selezionato: ${obj.name}`);
                                    }
                                },
                                'Clicca per focalizzare su {name}',
                                maxClickableElements
                            );
                        }
                    }, 500);
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        progressFill.style.width = percentComplete + '%';
                        const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
                        const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
                        loadingText.innerHTML = `
                            Caricamento modello ${modelName}...<br>
                            <small>${loadedMB}MB / ${totalMB}MB (${percentComplete.toFixed(1)}%)</small>
                        `;
                    }
                },
                (error) => {
                    console.error(`Errore nel caricamento del modello ${filename}:`, error);
                    clearTimeout(loadingTimeout);
                    clearInterval(progressInterval);
                    
                    // Mostra un messaggio di errore più dettagliato senza nascondere immediatamente il loader
                    loadingText.innerHTML = `
                        Errore nel caricamento di ${modelName}<br>
                        <small style="color: #f44336;">${error.message}</small><br>
                        <small style="color: #D4AF37;">Verificare la connessione di rete e riprovare</small>
                    `;
                    progressFill.style.background = '#f44336';
                    
                    // Nasconde il loader dopo 5 secondi per dare tempo all'utente di leggere l'errore
                    setTimeout(() => {
                        loading.classList.add('hidden');
                        instructions.style.display = 'block';
                        if (progressBar.parentNode) {
                            progressBar.parentNode.removeChild(progressBar);
                        }
                        loadingText.innerHTML = 'Caricamento modello...';
                    }, 5000);
                }
            );
        } catch (e) {
            console.error('Errore durante l\'inizializzazione di GLTFLoader:', e);
            alert('Errore durante l\'inizializzazione di GLTFLoader: ' + e.message);
            loading.classList.add('hidden');
            instructions.style.display = 'block';
        }
    }
    
    focusOnElement(element) {
        if (!element) return;
        
        // Calcola il bounding box dell'elemento
        const box = new THREE.Box3().setFromObject(element);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Calcola la distanza ottimale per visualizzare l'elemento
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5; // Distanza per vedere bene l'elemento
        
        // Calcola la nuova posizione della camera
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.negate(); // Inverti la direzione per guardare verso l'elemento
        
        const newPosition = center.clone().add(direction.multiplyScalar(distance));
        
        // Anima la camera verso la nuova posizione
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        const duration = 1000; // 1 secondo
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Usa easing per un'animazione più fluida
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpola posizione camera
            this.camera.position.lerpVectors(startPosition, newPosition, easeProgress);
            
            // Interpola target dei controlli
            this.controls.target.lerpVectors(startTarget, center, easeProgress);
            
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
        
        // Evidenzia temporaneamente l'elemento
        this.highlightElement(element);
    }
    
    highlightElement(element) {
        if (!element || !element.material) return;
        
        // Salva il colore originale
        const originalColor = element.material.color ? element.material.color.clone() : null;
        const originalEmissive = element.material.emissive ? element.material.emissive.clone() : null;
        
        // Applica evidenziazione
        if (element.material.emissive) {
            element.material.emissive.setHex(0x444444); // Colore emissivo per evidenziare
        }
        
        // Rimuovi evidenziazione dopo 2 secondi
        setTimeout(() => {
            if (originalEmissive && element.material.emissive) {
                element.material.emissive.copy(originalEmissive);
            }
        }, 2000);
    }
    
    // Rimossa funzione openS3ModelDialog
    
    // Rimossa funzione fetchS3ModelList
    // Fine rimozione funzione fetchS3ModelList
    
    // Funzione per aggiornare l'interfaccia con la lista dei modelli
    // Rimossa funzione updateS3ModelList
    
    // Rimossa funzione loadS3Model
    
    resetView() {
        if (this.currentModel) {
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            this.camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 1.5);
            this.controls.target.copy(box.getCenter(new THREE.Vector3()));
        } else {
            this.camera.position.set(5, 5, 5);
            this.controls.target.set(0, 0, 0);
        }
        
        this.controls.update();
    }
    
    toggleWireframe() {
        if (!this.currentModel) return;
        
        this.isWireframe = !this.isWireframe;
        
        this.currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.wireframe = this.isWireframe;
                    });
                } else {
                    child.material.wireframe = this.isWireframe;
                }
            }
        });
        
        const button = document.getElementById('wireframeBtn');
        button.textContent = this.isWireframe ? 'Solido' : 'Wireframe';
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Errore fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    toggleBackground() {
        // Inizializza la proprietà se non esiste
        if (this.isDarkBackground === undefined) {
            this.isDarkBackground = false; // Default è chiaro
        }
        
        this.isDarkBackground = !this.isDarkBackground;
        
        // Cambia il colore di sfondo della scena
        if (this.isDarkBackground) {
            this.scene.background = new THREE.Color(0x222222); // Scuro
        } else {
            this.scene.background = new THREE.Color(0xf0f0f0); // Chiaro
        }
        
        // Aggiorna il testo del pulsante
        const button = document.getElementById('backgroundBtn');
        if (button) {
            button.textContent = this.isDarkBackground ? 'Sfondo Chiaro' : 'Sfondo Scuro';
        }
        
        // Salva la preferenza nel localStorage
        localStorage.setItem('theme', this.isDarkBackground ? 'dark' : 'light');
    }
    
    // Funzione per aggiornare lo stato del pulsante di caricamento
    updateUploadButtonState() {
        const uploadModelBtn = document.getElementById('uploadModelBtn');
        if (uploadModelBtn) {
            if (this.isLoading) {
                // Disabilita il pulsante durante il caricamento
                uploadModelBtn.disabled = true;
                uploadModelBtn.classList.add('disabled');
                uploadModelBtn.title = 'Caricamento in corso... Attendere';
            } else {
                // Riabilita il pulsante quando il caricamento è completato
                uploadModelBtn.disabled = false;
                uploadModelBtn.classList.remove('disabled');
                uploadModelBtn.title = 'Carica un modello 3D';
            }
        }
    }
    
    // Funzione per svuotare la scena e rimuovere il modello corrente
    clearScene() {
        console.log('Svuotamento della scena...');
        
        // Rimuovi il modello corrente dalla scena
        if (this.currentModel) {
            console.log('Rimuovendo il modello esistente');
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }
        
        // Reimposta la gerarchia
        this.modelLayers = {};
        this.layerColors = {};
        this.updateHierarchyUI();
        
        // Reimposta gli oggetti cliccabili
        this.clickableObjects = [];
        
        // Reimposta il flag di caricamento
        this.isLoading = false;
        
        // Aggiorna lo stato del pulsante di caricamento
        this.updateUploadButtonState();
        
        // Nascondi eventuali tooltip
        const tooltip = document.getElementById('object-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
        
        console.log('Scena svuotata con successo');
    }
    
    // Funzione per mostrare le statistiche del modello
    showModelStatistics() {
        if (!this.currentModel) {
            alert('Nessun modello caricato. Carica prima un modello per visualizzare le statistiche.');
            return;
        }
        
        console.log('Calcolando statistiche del modello...');
        
        let totalVertices = 0;
        let totalFaces = 0;
        let totalMeshes = 0;
        let totalNodes = 0;
        let totalLayers = Object.keys(this.modelLayers).length;
        let totalMaterials = new Set();
        let totalTextures = new Set();
        
        // Attraversa tutti gli oggetti del modello per calcolare le statistiche
        this.currentModel.traverse((child) => {
            totalNodes++;
            
            if (child.isMesh) {
                totalMeshes++;
                
                if (child.geometry) {
                    // Conta i vertici
                    if (child.geometry.attributes.position) {
                        totalVertices += child.geometry.attributes.position.count;
                    }
                    
                    // Conta le facce (triangoli)
                    if (child.geometry.index) {
                        totalFaces += child.geometry.index.count / 3;
                    } else if (child.geometry.attributes.position) {
                        totalFaces += child.geometry.attributes.position.count / 3;
                    }
                }
                
                // Conta i materiali unici
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.uuid) totalMaterials.add(mat.uuid);
                            // Conta le texture
                            if (mat.map) totalTextures.add(mat.map.uuid);
                            if (mat.normalMap) totalTextures.add(mat.normalMap.uuid);
                            if (mat.roughnessMap) totalTextures.add(mat.roughnessMap.uuid);
                            if (mat.metalnessMap) totalTextures.add(mat.metalnessMap.uuid);
                        });
                    } else {
                        if (child.material.uuid) totalMaterials.add(child.material.uuid);
                        // Conta le texture
                        if (child.material.map) totalTextures.add(child.material.map.uuid);
                        if (child.material.normalMap) totalTextures.add(child.material.normalMap.uuid);
                        if (child.material.roughnessMap) totalTextures.add(child.material.roughnessMap.uuid);
                        if (child.material.metalnessMap) totalTextures.add(child.material.metalnessMap.uuid);
                    }
                }
            }
        });
        
        // Calcola la dimensione del modello in memoria (approssimativa)
        const modelSizeMB = this.modelSizeMB || 0;
        
        // Crea il messaggio con le statistiche
        const statsMessage = `📊 STATISTICHE DEL MODELLO 3D\n\n` +
            `🔺 Poligoni (Facce): ${totalFaces.toLocaleString()}\n` +
            `📐 Vertici: ${totalVertices.toLocaleString()}\n` +
            `🎭 Mesh: ${totalMeshes.toLocaleString()}\n` +
            `🌳 Nodi totali: ${totalNodes.toLocaleString()}\n` +
            `📁 Livelli/Layer: ${totalLayers}\n` +
            `🎨 Materiali: ${totalMaterials.size}\n` +
            `🖼️ Texture: ${totalTextures.size}\n` +
            `💾 Dimensione file: ${modelSizeMB > 0 ? modelSizeMB.toFixed(1) + ' MB' : 'Non disponibile'}`;
        
        // Mostra le statistiche in un alert
        alert(statsMessage);
        
        // Log delle statistiche nella console per debug
        console.log('Statistiche modello:', {
            poligoni: totalFaces,
            vertici: totalVertices,
            mesh: totalMeshes,
            nodi: totalNodes,
            livelli: totalLayers,
            materiali: totalMaterials.size,
            texture: totalTextures.size,
            dimensioneMB: modelSizeMB
        });
    }
    
    onWindowResize() {
        const header = document.querySelector('header');
        const controls = document.getElementById('controls');
        const headerHeight = header ? header.offsetHeight : 0;
        const controlsHeight = controls ? controls.offsetHeight : 0;
        const availableHeight = window.innerHeight - headerHeight - controlsHeight;
        
        this.camera.aspect = window.innerWidth / availableHeight;
        this.camera.updateProjectionMatrix();
        
        // Adatta la qualità del rendering in base alle dimensioni della finestra
        const smallScreen = window.innerWidth < 768 || availableHeight < 600;
        const mediumScreen = window.innerWidth < 1200 || availableHeight < 900;
        
        // Ottimizza automaticamente per schermi piccoli
        if (smallScreen && this.currentModel) {
            // Riduci drasticamente la qualità per schermi piccoli
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
            this.renderer.shadowMap.enabled = false;
            
            // Disabilita effetti avanzati per migliorare le prestazioni su dispositivi mobili
            if (!this.lowQualityRendering) {
                console.log('Applicando ottimizzazioni per schermo piccolo...');
                this.lowQualityRendering = true;
                
                // Applica ottimizzazioni simili a quelle per modelli grandi
                if (this.currentModel && !this.smallScreenOptimizationsApplied) {
                    this.applyHighMemoryOptimizations();
                    this.smallScreenOptimizationsApplied = true;
                }
            }
        } else if (mediumScreen && this.currentModel && this.modelSizeMB > 100) {
            // Per schermi medi con modelli grandi, applica ottimizzazioni moderate
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
        } else if (this.currentModel && this.modelSizeMB > 300) {
            // Mantieni ottimizzazioni per modelli critici indipendentemente dalla dimensione dello schermo
            this.renderer.setPixelRatio(1.0);
            this.renderer.shadowMap.enabled = false;
        } else {
            // Ripristina impostazioni di qualità per schermi grandi con modelli piccoli
            if (this.lowQualityRendering && !this.emergencyOptimizationsApplied) {
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.lowQualityRendering = false;
            }
        }
        
        // Aggiorna le dimensioni del renderer
        this.renderer.setSize(window.innerWidth, availableHeight);
        
        // Controlla l'uso della memoria dopo il ridimensionamento
        if (this.currentModel && 'memory' in performance) {
            const memInfo = performance.memory;
            const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
            const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
            const usagePercent = (usedMB / limitMB) * 100;
            
            // Se l'uso della memoria è critico dopo il ridimensionamento, applica ottimizzazioni di emergenza
            if (usagePercent > 90 && !this.emergencyOptimizationsApplied) {
                console.warn(`Memoria critica dopo ridimensionamento: ${usagePercent.toFixed(1)}% utilizzata`);
                this.applyEmergencyOptimizations();
                this.emergencyOptimizationsApplied = true;
            }
        }
    }
    
    setupSimpleLOD(object) {
        // Implementa un sistema di Level of Detail (LOD) semplice
        // Questa funzione crea versioni semplificate degli oggetti mesh per migliorare le prestazioni
        // quando la telecamera è lontana dall'oggetto
        
        const meshes = [];
        object.traverse(child => {
            if (child.isMesh && child.geometry) {
                meshes.push(child);
            }
        });
        
        console.log(`Creando LOD per ${meshes.length} mesh...`);
        
        // Limita il numero di mesh da processare per evitare sovraccarichi
        const maxMeshesToProcess = 50;
        const meshesToProcess = meshes.slice(0, maxMeshesToProcess);
        
        // Crea LOD solo per mesh con un numero molto significativo di vertici (soglia aumentata)
        meshesToProcess.forEach(mesh => {
            // Verifica se la mesh ha abbastanza vertici da giustificare un LOD
            const vertexCount = mesh.geometry.attributes.position.count;
            if (vertexCount > 5000) {
                // Crea un oggetto LOD
                const lod = new THREE.LOD();
                
                // Posiziona il LOD nella stessa posizione della mesh originale
                lod.position.copy(mesh.position);
                lod.rotation.copy(mesh.rotation);
                lod.scale.copy(mesh.scale);
                
                // Aggiungi la mesh originale come livello di dettaglio più alto
                lod.addLevel(mesh, 0);
                
                // Crea una versione semplificata della mesh (riduzione del 75% dei vertici)
                // Nota: in una implementazione reale, si userebbe un algoritmo di decimazione
                // come SimplifyModifier, ma qui simuliamo una mesh semplificata
                const simplifiedMesh = mesh.clone();
                
                // Simula una geometria semplificata riducendo la risoluzione del materiale
                if (simplifiedMesh.material) {
                    if (Array.isArray(simplifiedMesh.material)) {
                        simplifiedMesh.material.forEach(mat => {
                            mat.wireframe = false;
                            mat.flatShading = true;
                            if (mat.map) mat.map.minFilter = THREE.NearestFilter;
                        });
                    } else {
                        simplifiedMesh.material.wireframe = false;
                        simplifiedMesh.material.flatShading = true;
                        if (simplifiedMesh.material.map) {
                            simplifiedMesh.material.map.minFilter = THREE.NearestFilter;
                        }
                    }
                }
                
                // Aggiungi la mesh semplificata come livello di dettaglio medio (distanza aumentata)
                lod.addLevel(simplifiedMesh, 50);
                
                // Crea una versione molto semplificata per distanze maggiori
                const verySimplifiedMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1, 1),
                    new THREE.MeshBasicMaterial({ color: 0x888888 })
                );
                
                // Scala il box per adattarlo alle dimensioni della mesh originale
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                verySimplifiedMesh.scale.set(size.x, size.y, size.z);
                
                // Aggiungi la mesh molto semplificata come livello di dettaglio più basso (distanza molto aumentata)
                lod.addLevel(verySimplifiedMesh, 200);
                
                // Sostituisci la mesh originale con l'oggetto LOD
                if (mesh.parent) {
                    const parent = mesh.parent;
                    const index = parent.children.indexOf(mesh);
                    if (index !== -1) {
                        parent.children.splice(index, 1, lod);
                    }
                }
            }
        });
        
        console.log('Sistema LOD configurato con successo');
    }
    
    checkMemoryUsage(modelSizeMB) {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
            const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
            const usagePercent = (usedMB / limitMB) * 100;
            
            console.log(`Memoria utilizzata: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);
            
            // Salva la dimensione del modello per riferimento futuro
            this.modelSizeMB = modelSizeMB || 0;
            
            // Applica ottimizzazioni preventive basate sulla dimensione del modello
            if (modelSizeMB > 300 && !this.criticalOptimizationsApplied) {
                console.warn('Modello molto grande (>300MB) rilevato. Applicando ottimizzazioni preventive...');
                this.applyCriticalModelOptimizations();
                this.criticalOptimizationsApplied = true;
            } else if (modelSizeMB > 100 && !this.largeModelOptimizationsApplied) {
                console.warn('Modello grande (>100MB) rilevato. Applicando ottimizzazioni preventive...');
                this.applyLargeModelOptimizations();
                this.largeModelOptimizationsApplied = true;
            }
            
            // Gestione memoria in base all'utilizzo
            if (usagePercent > 80) {
                console.warn('Uso memoria elevato! Applicando ottimizzazioni automatiche.');
                
                // Applica ottimizzazioni progressive in base all'utilizzo della memoria
                if (usagePercent > 90) {
                    if (!this.emergencyOptimizationsApplied) {
                        alert('Attenzione: Memoria quasi esaurita. Applicando ottimizzazioni di emergenza.');
                        this.applyEmergencyOptimizations();
                        this.emergencyOptimizationsApplied = true;
                    }
                } else if (usagePercent > 85) {
                    if (!this.highMemoryOptimizationsApplied) {
                        this.applyHighMemoryOptimizations();
                        this.highMemoryOptimizationsApplied = true;
                    }
                }
            }
            
            // Suggerisci ottimizzazioni per modelli grandi
            if (modelSizeMB > 50 && usagePercent > 60) {
                console.log('Suggerimento: Per modelli grandi, considera di disabilitare le ombre per migliorare le prestazioni.');
            }
            
            return usagePercent;
        }
        return 0;
    }
    
    // Ottimizzazioni per modelli critici (>300MB)
    applyCriticalModelOptimizations() {
        console.warn('Applicando ottimizzazioni per modello critico (>300MB)...');
        
        // Riduci drasticamente la qualità del renderer
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.lowQualityRendering = true;
        
        if (this.currentModel) {
            // Applica ottimizzazioni aggressive a tutti i materiali e geometrie
            this.currentModel.traverse(child => {
                if (child.isMesh) {
                    // Abilita frustum culling aggressivo
                    child.frustumCulled = true;
                    
                    // Semplifica la geometria
                    if (child.geometry) {
                        // Verifica se il materiale ha normal maps che richiedono tangent/bitangent
                        let hasNormalMap = false;
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            hasNormalMap = materials.some(mat => mat.normalMap);
                        }
                        
                        // Rimuovi attributi non essenziali per risparmiare memoria
                        // Ma preserva tangent/bitangent se ci sono normal maps
                        const attributesToRemove = hasNormalMap ? ['color', 'uv2'] : ['color', 'uv2', 'tangent', 'bitangent'];
                        attributesToRemove.forEach(attr => {
                            if (child.geometry.attributes[attr]) {
                                child.geometry.deleteAttribute(attr);
                            }
                        });
                        
                        // RIMOSSO: La conversione da Float32Array a Int16Array causa errori del shader WebGL
                        // Manteniamo la precisione originale per evitare errori di compilazione shader
                    }
                    
                    // Semplifica drasticamente i materiali
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            // Ottimizza texture prima di sostituire i materiali
                            child.material.forEach(m => {
                                if (m.map) {
                                    // Applica ottimizzazioni estreme alle texture
                                    this.optimizeTexture(m.map, 'extreme');
                                }
                                m.dispose(); // Libera memoria
                            });
                            
                            // Sostituisci tutti i materiali con un materiale base
                            const simpleMaterial = new THREE.MeshBasicMaterial({ 
                                color: 0xcccccc,
                                flatShading: true
                            });
                            child.material = simpleMaterial;
                        } else {
                            // Ottimizza texture prima di sostituire il materiale
                            if (child.material.map) {
                                this.optimizeTexture(child.material.map, 'extreme');
                            }
                            
                            // Converti in materiale base
                            const color = child.material.color ? child.material.color.getHex() : 0xcccccc;
                            child.material.dispose(); // Libera memoria del materiale
                            child.material = new THREE.MeshBasicMaterial({ 
                                color: color,
                                flatShading: true
                            });
                        }
                    }
                    
                    // Disabilita solo oggetti estremamente piccoli (solo se le ottimizzazioni aggressive sono abilitate)
                    if (this.aggressiveOptimizationsEnabled && child.geometry && child.geometry.attributes.position.count < 10) {
                        child.visible = false;
                    }
                }
            });
            
            // Implementa LOD per modelli critici (solo se le ottimizzazioni aggressive sono abilitate)
            if (this.aggressiveOptimizationsEnabled) {
                this.setupSimpleLOD(this.currentModel);
            }
            
            // Riduci la risoluzione del renderer
            this.renderer.setSize(
                Math.floor(window.innerWidth * 0.8),
                Math.floor((window.innerHeight - 140) * 0.8)
            );
            
            // Forza la garbage collection
            if (window.gc) {
                window.gc();
            } else {
                // Tenta di forzare la garbage collection indirettamente
                const arr = [];
                for (let i = 0; i < 1000000; i++) {
                    arr.push(new ArrayBuffer(1024));
                }
                arr.length = 0;
            }
            
            console.log('Ottimizzazioni per modello critico applicate');
        }
    }
    
    // Ottimizzazioni per modelli grandi (>100MB)
    applyLargeModelOptimizations() {
        console.warn('Applicando ottimizzazioni per modello grande (>100MB)...');
        
        // Riduci la qualità del renderer ma mantieni alcune funzionalità
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Usa shadow map più semplici
        
        if (this.currentModel) {
            // Applica ottimizzazioni moderate a tutti i materiali e geometrie
            this.currentModel.traverse(child => {
                if (child.isMesh) {
                    // Abilita frustum culling
                    child.frustumCulled = true;
                    
                    // Ottimizza materiali
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        
                        materials.forEach(material => {
                            // Riduci la qualità delle texture usando la funzione ottimizzata
                            if (material.map) {
                                this.optimizeTexture(material.map, 'high');
                            }
                            
                            // Disabilita effetti avanzati
                            material.envMap = null;
                            material.lightMap = null;
                            material.aoMap = null;
                            material.emissiveMap = null;
                            
                            // Riduci la complessità del materiale
                            material.flatShading = true;
                            material.wireframe = false;
                            material.transparent = false;
                            material.fog = false;
                        });
                    }
                    
                    // Ottimizza geometria per modelli con molti vertici
                    if (child.geometry && child.geometry.attributes.position.count > 10000) {
                        // Verifica se il materiale ha normal maps che richiedono tangent
                        let hasNormalMap = false;
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            hasNormalMap = materials.some(mat => mat.normalMap);
                        }
                        
                        // Rimuovi attributi non essenziali per risparmiare memoria
                        // Ma preserva tangent se ci sono normal maps
                        const attributesToRemove = hasNormalMap ? ['color'] : ['color', 'tangent'];
                        attributesToRemove.forEach(attr => {
                            if (child.geometry.attributes[attr]) {
                                child.geometry.deleteAttribute(attr);
                            }
                        });
                    }
                }
            });
            
            // Configura un intervallo per controllare periodicamente l'uso della memoria
            if (!this.memoryCheckIntervalId) {
                this.memoryCheckIntervalId = setInterval(() => {
                    if ('memory' in performance) {
                        const memInfo = performance.memory;
                        const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
                        const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
                        const usagePercent = (usedMB / limitMB) * 100;
                        
                        if (usagePercent > 85 && !this.highMemoryOptimizationsApplied) {
                            console.warn(`Memoria alta durante rendering: ${usagePercent.toFixed(1)}% utilizzata`);
                            this.applyHighMemoryOptimizations();
                            this.highMemoryOptimizationsApplied = true;
                        }
                    }
                }, this.memoryCheckInterval);
            }
            
            console.log('Ottimizzazioni per modello grande applicate');
        }
    }
    
    // Ottimizzazioni per uso elevato di memoria (>85%)
    applyHighMemoryOptimizations() {
        console.warn('Applicando ottimizzazioni per uso elevato di memoria...');
        
        // Riduci la qualità del renderer
        const currentPixelRatio = this.renderer.getPixelRatio();
        this.renderer.setPixelRatio(Math.min(currentPixelRatio, 1.0));
        
        if (this.currentModel) {
            // Applica ottimizzazioni selettive
            this.currentModel.traverse(child => {
                if (child.isMesh) {
                    // Disabilita ombre per tutti gli oggetti
                    child.castShadow = false;
                    child.receiveShadow = false;
                    
                    // Ottimizza materiali selettivamente
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        
                        materials.forEach(material => {
                            // Riduci la qualità delle texture
                            if (material.map) {
                                this.optimizeTexture(material.map, 'high');
                            }
                            
                            // Disabilita effetti costosi
                            material.envMap = null;
                        });
                    }
                }
            });
            
            console.log('Ottimizzazioni per uso elevato di memoria applicate');
        }
    }
    
    // Optimize texture with dynamic quality based on device capabilities
    optimizeTexture(texture, level = 'medium') {
        if (!texture) return;
        
        // Rileva capacità del dispositivo
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEndDevice = isMobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
        
        // Determina il livello di ottimizzazione in base al dispositivo e al parametro level
        let optimizationLevel = level;
        if (isLowEndDevice && level === 'medium') {
            optimizationLevel = 'high';
        } else if (this.modelSizeMB > 300) {
            optimizationLevel = 'extreme';
        } else if (this.modelSizeMB > 100 && level === 'medium') {
            optimizationLevel = 'high';
        }
        
        // Applica ottimizzazioni in base al livello
        switch (optimizationLevel) {
            case 'low':
                // Ottimizzazioni leggere per modelli piccoli
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;
                texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                break;
                
            case 'medium':
                // Ottimizzazioni moderate per modelli medi
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                texture.anisotropy = 1;
                break;
                
            case 'high':
                // Ottimizzazioni aggressive per modelli grandi
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
                texture.anisotropy = 1;
                
                // Riduci la risoluzione della texture per modelli grandi
                if (texture.image && texture.image.width > 512) {
                    this.reduceTextureResolution(texture, 0.5);
                }
                break;
                
            case 'extreme':
                // Ottimizzazioni estreme per modelli critici
                texture.minFilter = THREE.NearestFilter;
                texture.magFilter = THREE.NearestFilter;
                texture.generateMipmaps = false;
                texture.anisotropy = 1;
                
                // Riduci drasticamente la risoluzione della texture per modelli critici
                if (texture.image && texture.image.width > 256) {
                    this.reduceTextureResolution(texture, 0.25);
                }
                break;
        }
        
        texture.needsUpdate = true;
    }
    
    // Riduce la risoluzione di una texture (versione sicura)
    reduceTextureResolution(texture, scale) {
        if (!texture || !texture.image) return;
        
        try {
            // Verifica che l'immagine sia valida e caricata
            if (!texture.image.complete || texture.image.naturalWidth === 0) {
                console.warn('Texture non completamente caricata, saltando ridimensionamento');
                return;
            }
            
            // Crea un canvas temporaneo per ridimensionare l'immagine
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.warn('Impossibile ottenere contesto 2D del canvas');
                return;
            }
            
            // Calcola le nuove dimensioni
            const originalWidth = texture.image.width || texture.image.naturalWidth;
            const originalHeight = texture.image.height || texture.image.naturalHeight;
            
            const newWidth = Math.max(32, Math.floor(originalWidth * scale));
            const newHeight = Math.max(32, Math.floor(originalHeight * scale));
            
            // Imposta le dimensioni del canvas
            canvas.width = newWidth;
            canvas.height = newHeight;
            
            // Configura il contesto per una migliore qualità
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Disegna l'immagine ridimensionata sul canvas
            ctx.drawImage(texture.image, 0, 0, newWidth, newHeight);
            
            // Crea una nuova texture invece di modificare quella esistente
            const newTexture = new THREE.CanvasTexture(canvas);
            
            // Copia le proprietà importanti dalla texture originale
            newTexture.wrapS = texture.wrapS;
            newTexture.wrapT = texture.wrapT;
            newTexture.minFilter = texture.minFilter;
            newTexture.magFilter = texture.magFilter;
            newTexture.format = texture.format;
            newTexture.type = texture.type;
            newTexture.anisotropy = texture.anisotropy;
            newTexture.generateMipmaps = texture.generateMipmaps;
            
            // Sostituisci l'immagine della texture originale
            texture.image = canvas;
            texture.needsUpdate = true;
            
            console.log(`Texture ridimensionata da ${originalWidth}x${originalHeight} a ${newWidth}x${newHeight}`);
            
        } catch (error) {
            console.warn('Errore durante il ridimensionamento della texture:', error);
            // In caso di errore, non modificare la texture
        }
    }
    
    // Ottimizzazioni di emergenza per situazioni critiche (>90% memoria)
    applyEmergencyOptimizations() {
        console.warn('Applicando ottimizzazioni di emergenza per liberare memoria...');
        
        // Riduci drasticamente la qualità del renderer
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.lowQualityRendering = true;
        
        if (this.currentModel) {
            // Rimuovi texture e semplifica materiali
            this.currentModel.traverse(child => {
                if (child.isMesh) {
                    // Semplifica la geometria se possibile
                    if (child.geometry && child.geometry.attributes.position.count > 1000) {
                        // Rimuovi attributi non essenziali
                        ['normal', 'uv', 'color', 'tangent', 'uv2', 'bitangent'].forEach(attr => {
                            if (child.geometry.attributes[attr]) {
                                child.geometry.deleteAttribute(attr);
                            }
                        });
                        
                        // Ricalcola le normali in modo semplificato se necessario
                        if (!child.geometry.attributes.normal) {
                            child.geometry.computeVertexNormals();
                        }
                    }
                    
                    // Semplifica materiali
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            // Ottimizza texture prima di sostituire i materiali
                            child.material.forEach(m => {
                                if (m.map) {
                                    // Applica ottimizzazioni estreme alle texture
                                    this.optimizeTexture(m.map, 'extreme');
                                }
                                m.dispose(); // Libera memoria
                            });
                            // Sostituisci tutti i materiali con un materiale base
                            child.material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
                        } else {
                            // Ottimizza texture prima di sostituire il materiale
                            if (child.material.map) {
                                this.optimizeTexture(child.material.map, 'extreme');
                            }
                            // Converti in materiale base
                            const color = child.material.color ? child.material.color.getHex() : 0xcccccc;
                            child.material.dispose(); // Libera memoria del materiale
                            child.material = new THREE.MeshBasicMaterial({ color: color });
                        }
                    }
                    
                    // Disabilita solo oggetti estremamente piccoli (solo se le ottimizzazioni aggressive sono abilitate)
                    if (this.aggressiveOptimizationsEnabled && child.geometry && child.geometry.attributes.position.count < 20) {
                        child.visible = false;
                    }
                    
                    // Abilita frustum culling aggressivo
                    child.frustumCulled = true;
                }
            });
            
            // Riduci la risoluzione del renderer
            this.renderer.setSize(
                Math.floor(window.innerWidth * 0.75),
                Math.floor((window.innerHeight - 140) * 0.75)
            );
            
            // Forza la garbage collection
            if (window.gc) {
                window.gc();
            } else {
                // Tenta di forzare la garbage collection indirettamente
                const arr = [];
                for (let i = 0; i < 1000000; i++) {
                    arr.push(new ArrayBuffer(1024));
                }
                arr.length = 0;
            }
            
            console.log('Ottimizzazioni di emergenza applicate');
        }
    }
    
    // Funzione per disabilitare le ottimizzazioni aggressive e ripristinare la visibilità
    disableAggressiveOptimizations() {
        console.log('Disabilitando ottimizzazioni aggressive...');
        this.aggressiveOptimizationsEnabled = false;
        
        if (this.currentModel) {
            // Ripristina la visibilità di tutti gli oggetti
            this.currentModel.traverse(child => {
                if (child.isMesh && !child.visible) {
                    child.visible = true;
                }
            });
            
            // Ripristina la qualità del renderer
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.lowQualityRendering = false;
            
            console.log('Ottimizzazioni aggressive disabilitate e visibilità ripristinata');
        }
    }
    
    // Funzione per riabilitare le ottimizzazioni aggressive
    enableAggressiveOptimizations() {
        console.log('Riabilitando ottimizzazioni aggressive...');
        this.aggressiveOptimizationsEnabled = true;
        
        // Riapplica le ottimizzazioni se necessario
        if (this.modelSizeMB > 300) {
            this.applyCriticalModelOptimizations();
        } else if (this.modelSizeMB > 100) {
            this.applyLargeModelOptimizations();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Check memory periodically (every 5 seconds)
        const now = Date.now();
        if (now - this.lastMemoryCheck > 5000) {
            this.lastMemoryCheck = now;
            if ('memory' in performance && this.currentModel) {
                const memInfo = performance.memory;
                const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
                const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
                const usagePercent = (usedMB / limitMB) * 100;
                
                if (usagePercent > 85) {
                    console.warn(`Memoria critica: ${usagePercent.toFixed(1)}% utilizzata`);
                    
                    // Applica ottimizzazioni di emergenza se l'uso della memoria è critico
                    if (usagePercent > 90 && !this.emergencyOptimizationsApplied) {
                        this.applyEmergencyOptimizations();
                        this.emergencyOptimizationsApplied = true;
                    }
                }
            }
        }
        
        // Ottimizzazione dinamica del frustum culling per modelli grandi (solo se le ottimizzazioni aggressive sono abilitate)
        if (this.currentModel && this.modelSizeMB > 100 && this.aggressiveOptimizationsEnabled) {
            // Aggiorna la matrice di frustum della camera
            this.camera.updateMatrixWorld();
            const frustum = new THREE.Frustum();
            frustum.setFromProjectionMatrix(
                new THREE.Matrix4().multiplyMatrices(
                    this.camera.projectionMatrix,
                    this.camera.matrixWorldInverse
                )
            );
            
            // Applica culling dinamico basato sulla distanza e dimensione
            this.currentModel.traverse(child => {
                if (child.isMesh) {
                    // Calcola la distanza dalla camera
                    const distance = this.camera.position.distanceTo(child.position);
                    
                    // Disabilita rendering per oggetti molto piccoli a grande distanza
                    if (child.geometry && child.geometry.attributes.position) {
                        const vertexCount = child.geometry.attributes.position.count;
                        
                        // Più aggressivo per modelli molto grandi
                        if (this.modelSizeMB > 300) {
                            // Disabilita oggetti piccoli a distanza media
                            if (vertexCount < 100 && distance > 20) {
                                child.visible = false;
                                return;
                            }
                            
                            // Disabilita oggetti medi a grande distanza
                            if (vertexCount < 500 && distance > 50) {
                                child.visible = false;
                                return;
                            }
                        } else if (this.modelSizeMB > 100) {
                            // Disabilita solo oggetti molto piccoli a grande distanza
                            if (vertexCount < 50 && distance > 50) {
                                child.visible = false;
                                return;
                            }
                        }
                        
                        // Riattiva oggetti se tornano nel campo visivo
                        if (!child.visible) {
                            // Calcola bounding box/sphere se non esiste
                            if (!child.geometry.boundingSphere) {
                                child.geometry.computeBoundingSphere();
                            }
                            
                            // Verifica se l'oggetto è nel frustum
                            const sphere = child.geometry.boundingSphere.clone();
                            sphere.applyMatrix4(child.matrixWorld);
                            
                            if (frustum.intersectsSphere(sphere)) {
                                child.visible = true;
                            }
                        }
                    }
                }
            });
        } else if (this.currentModel && !this.aggressiveOptimizationsEnabled) {
            // Se le ottimizzazioni aggressive sono disabilitate, assicurati che tutti gli oggetti siano visibili
            this.currentModel.traverse(child => {
                if (child.isMesh && !child.visible) {
                    child.visible = true;
                }
            });
        }
        
        // Check for intersections with clickable objects
        this.checkIntersections();
        
        this.controls.update();
        
        // Ottimizzazione del rendering per modelli grandi
        if (this.currentModel && this.modelSizeMB > 300 && !this.lowQualityRendering) {
            // Riduci temporaneamente la qualità del rendering
            const originalPixelRatio = this.renderer.getPixelRatio();
            this.renderer.setPixelRatio(Math.min(originalPixelRatio, 1.0));
            this.renderer.render(this.scene, this.camera);
            this.renderer.setPixelRatio(originalPixelRatio);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // Metodo per aggiungere un oggetto cliccabile
    makeObjectClickable(object, onClick, tooltip = '') {
        if (!object) return;
        
        // Aggiungi proprietà per identificare l'oggetto come cliccabile
        object.userData.isClickable = true;
        object.userData.onClick = onClick;
        object.userData.tooltip = tooltip;
        
        // Aggiungi l'oggetto alla lista degli oggetti cliccabili
        this.clickableObjects.push(object);
        
        // Aggiorna la lista degli elementi cliccabili nel menu
        this.updateHierarchyUI();
        
        console.log(`Oggetto reso cliccabile: ${object.name || 'Senza nome'}`);
        return object;
    }
    
    // Metodo per rimuovere un oggetto dalla lista dei cliccabili
    removeClickable(object) {
        if (!object) return;
        
        // Rimuovi le proprietà che lo identificano come cliccabile
        object.userData.isClickable = false;
        object.userData.onClick = null;
        object.userData.tooltip = '';
        
        // Rimuovi l'oggetto dalla lista
        const index = this.clickableObjects.indexOf(object);
        if (index !== -1) {
            this.clickableObjects.splice(index, 1);
            console.log(`Oggetto rimosso dai cliccabili: ${object.name || 'Senza nome'}`);
        }
    }
    
    // Metodo per controllare le intersezioni con oggetti cliccabili
    checkIntersections() {
        if (this.clickableObjects.length === 0) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Per modelli compressi, usa un approccio basato sulla gerarchia
        if (this.isCurrentModelCompressed && this.modelLayers && Object.keys(this.modelLayers).length > 0) {
            this.checkIntersectionsWithHierarchy();
        } else {
            // Usa il metodo tradizionale per modelli non compressi
            this.checkIntersectionsWithRaycaster();
        }
    }
    
    checkIntersectionsWithRaycaster() {
        // Trova intersezioni con oggetti cliccabili
        const intersects = this.raycaster.intersectObjects(this.clickableObjects, true);
        
        // Gestisci hover
        if (intersects.length > 0) {
            // Trova il primo oggetto cliccabile nell'array di intersezioni
            let clickableObject = null;
            for (const intersect of intersects) {
                // Controlla se l'oggetto o uno dei suoi genitori è cliccabile
                let obj = intersect.object;
                while (obj) {
                    if (obj.userData && obj.userData.isClickable) {
                        clickableObject = obj;
                        break;
                    }
                    obj = obj.parent;
                }
                if (clickableObject) break;
            }
            
            if (clickableObject) {
                // Se abbiamo trovato un oggetto cliccabile
                if (this.hoveredObject !== clickableObject) {
                    // Se stiamo entrando in un nuovo oggetto
                    if (this.hoveredObject) {
                        // Reset dell'oggetto precedente
                        this.onObjectLeave(this.hoveredObject);
                    }
                    
                    // Imposta il nuovo oggetto come hoveredObject
                    this.hoveredObject = clickableObject;
                    this.onObjectEnter(clickableObject);
                }
                
                // Cambia il cursore per indicare che l'oggetto è cliccabile
                this.renderer.domElement.style.cursor = 'pointer';
                
                // Mostra tooltip se disponibile
                if (clickableObject.userData.tooltip) {
                    // Qui potresti implementare la visualizzazione di un tooltip
                    // Per ora lo stampiamo solo in console
                    // console.log(`Tooltip: ${clickableObject.userData.tooltip}`);
                }
            } else {
                // Nessun oggetto cliccabile trovato nelle intersezioni
                if (this.hoveredObject) {
                    this.onObjectLeave(this.hoveredObject);
                    this.hoveredObject = null;
                }
                this.renderer.domElement.style.cursor = 'auto';
            }
        } else {
            // Nessuna intersezione
            if (this.hoveredObject) {
                this.onObjectLeave(this.hoveredObject);
                this.hoveredObject = null;
            }
            this.renderer.domElement.style.cursor = 'auto';
        }
    }
    
    checkIntersectionsWithHierarchy() {
        // Per modelli compressi, usa l'intero modello per il raycaster
        const intersects = this.raycaster.intersectObjects([this.currentModel], true);
        
        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point;
            let closestObject = null;
            let closestDistance = Infinity;
            
            // Cerca l'oggetto cliccabile più vicino al punto di intersezione
            this.clickableObjects.forEach((obj, index) => {
                if (obj.userData && obj.userData.isClickable && obj.visible) {
                    // Calcola la distanza dal punto di intersezione al centro dell'oggetto
                    const objBox = new THREE.Box3().setFromObject(obj);
                    const objCenter = objBox.getCenter(new THREE.Vector3());
                    const distance = intersectionPoint.distanceTo(objCenter);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestObject = obj;
                    }
                }
            });
            
            if (closestObject) {
                // Se abbiamo trovato un oggetto cliccabile
                if (this.hoveredObject !== closestObject) {
                    // Se stiamo entrando in un nuovo oggetto
                    if (this.hoveredObject) {
                        // Reset dell'oggetto precedente
                        this.onObjectLeave(this.hoveredObject);
                    }
                    
                    // Imposta il nuovo oggetto come hoveredObject
                    this.hoveredObject = closestObject;
                    this.onObjectEnter(closestObject);
                }
                
                // Cambia il cursore per indicare che l'oggetto è cliccabile
                this.renderer.domElement.style.cursor = 'pointer';
            } else {
                // Nessun oggetto cliccabile trovato
                if (this.hoveredObject) {
                    this.onObjectLeave(this.hoveredObject);
                    this.hoveredObject = null;
                }
                this.renderer.domElement.style.cursor = 'auto';
            }
        } else {
            // Nessuna intersezione
            if (this.hoveredObject) {
                this.onObjectLeave(this.hoveredObject);
                this.hoveredObject = null;
            }
            this.renderer.domElement.style.cursor = 'auto';
        }
    }
    
    // Metodo chiamato quando il mouse entra in un oggetto cliccabile
    onObjectEnter(object) {
        // Evidenzia l'oggetto (ad esempio cambiando il colore)
        if (object.material) {
            // Salva il colore originale
            if (!object.userData.originalColor) {
                if (Array.isArray(object.material)) {
                    object.userData.originalColor = object.material.map(m => m.color.clone());
                } else {
                    object.userData.originalColor = object.material.color.clone();
                }
            }
            
            // Cambia il colore per evidenziare
            if (Array.isArray(object.material)) {
                object.material.forEach(m => {
                    m.emissive = new THREE.Color(0x333333);
                });
            } else {
                object.material.emissive = new THREE.Color(0x333333);
            }
        }
        
        // Mostra il tooltip
        const tooltip = document.getElementById('object-tooltip');
        if (tooltip) {
            // Imposta il testo del tooltip
            let tooltipText = object.userData.tooltip || `Clicca su ${object.name}`;
            
            // Sostituisci {name} con il nome dell'oggetto
            tooltipText = tooltipText.replace('{name}', object.name);
            
            tooltip.textContent = tooltipText;
            tooltip.classList.remove('hidden');
            this.updateTooltipPosition(tooltip);
        }
    }
    
    // Metodo chiamato quando il mouse esce da un oggetto cliccabile
    onObjectLeave(object) {
        // Ripristina l'aspetto originale
        if (object.material) {
            // Ripristina il colore originale
            if (Array.isArray(object.material)) {
                object.material.forEach(m => {
                    m.emissive = new THREE.Color(0x000000);
                });
            } else {
                object.material.emissive = new THREE.Color(0x000000);
            }
        }
        
        // Nascondi il tooltip
        const tooltip = document.getElementById('object-tooltip');
        if (tooltip) {
            tooltip.classList.add('hidden');
        }
    }
    
    // Aggiorna la posizione del tooltip in base alla posizione del mouse
    updateTooltipPosition(tooltip) {
        if (!tooltip) return;
        
        // Posiziona il tooltip vicino al cursore
        tooltip.style.left = `${this.mouse.clientX + 15}px`;
        tooltip.style.top = `${this.mouse.clientY + 15}px`;
    }
    
    // Mostra il nome dell'elemento selezionato
    showSelectedElement(object) {
        if (!object) return;
        
        const tooltip = document.getElementById('object-tooltip');
        if (tooltip) {
            // Imposta il testo del tooltip con il nome dell'oggetto
            tooltip.textContent = `Tap di nuovo per selezionare: ${object.name}`;
            tooltip.classList.remove('hidden');
            
            // Posiziona il tooltip vicino al punto di tocco
            const rect = this.renderer.domElement.getBoundingClientRect();
            const x = (this.mouse.x + 1) / 2 * rect.width + rect.left;
            const y = (1 - (this.mouse.y + 1) / 2) * rect.height + rect.top;
            
            tooltip.style.left = `${x + 15}px`; // Offset per non coprire il punto di tocco
            tooltip.style.top = `${y}px`;
            
            // Evidenzia l'oggetto
            if (object.material) {
                // Salva il colore originale se non è già stato salvato
                if (!object.userData.originalColor) {
                    if (Array.isArray(object.material)) {
                        object.userData.originalColor = object.material.map(m => m.color.clone());
                    } else {
                        object.userData.originalColor = object.material.color.clone();
                    }
                }
                
                // Cambia il colore per evidenziare
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => {
                        m.emissive = new THREE.Color(0x333333);
                    });
                } else {
                    object.material.emissive = new THREE.Color(0x333333);
                }
            }
        }
    }
    
    // Nascondi il tooltip dell'elemento selezionato
    hideSelectedElement() {
        const tooltip = document.getElementById('object-tooltip');
        if (tooltip) {
            tooltip.classList.add('hidden');
        }
        
        // Ripristina l'aspetto originale dell'oggetto precedentemente selezionato
        if (this.lastSelectedObject && this.lastSelectedObject.material) {
            // Ripristina il colore originale
            if (Array.isArray(this.lastSelectedObject.material)) {
                this.lastSelectedObject.material.forEach(m => {
                    m.emissive = new THREE.Color(0x000000);
                });
            } else {
                this.lastSelectedObject.material.emissive = new THREE.Color(0x000000);
            }
        }
    }
    
    // Gestione del click del mouse
    onMouseClick(event) {
        // Previeni il click se stiamo usando i controlli OrbitControls
        if (this.controls.enabled && this.controls.isDragging) return;
        
        // Calcola la posizione del mouse normalizzata
        this.updateMousePosition(event);
        
        // Usa il raycaster per trovare intersezioni
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickableObjects, true);
        
        if (intersects.length > 0) {
            // Trova il primo oggetto cliccabile nell'array di intersezioni
            let clickableObject = null;
            for (const intersect of intersects) {
                // Controlla se l'oggetto o uno dei suoi genitori è cliccabile
                let obj = intersect.object;
                while (obj) {
                    if (obj.userData && obj.userData.isClickable) {
                        clickableObject = obj;
                        break;
                    }
                    obj = obj.parent;
                }
                if (clickableObject) break;
            }
            
            if (clickableObject && clickableObject.userData.onClick) {
                // Esegui la funzione di callback associata all'oggetto
                clickableObject.userData.onClick(clickableObject);
            }
        }
    }
    
    // Gestisce il movimento del mouse
    onMouseMove(event) {
        this.updateMousePosition(event);
        
        // Aggiorna la posizione del tooltip se è visibile
        const tooltip = document.getElementById('object-tooltip');
        if (tooltip && !tooltip.classList.contains('hidden')) {
            this.updateTooltipPosition(tooltip);
        }
    }
    
    // Gestione del touch con sistema a doppio tap
    onTouchStart(event) {
        // Previeni il touch se ci sono più di un tocco (probabilmente è un gesto di zoom/pan)
        if (event.touches.length > 1) return;
        
        // Previeni il click se stiamo usando i controlli OrbitControls
        if (this.controls.enabled && this.controls.isDragging) return;
        
        // Converti il touch in coordinate del mouse
        const touch = event.touches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        
        this.updateMousePosition(mouseEvent);
        
        // Usa il raycaster per trovare intersezioni
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickableObjects, true);
        
        if (intersects.length > 0) {
            // Trova il primo oggetto cliccabile nell'array di intersezioni
            let clickableObject = null;
            for (const intersect of intersects) {
                // Controlla se l'oggetto o uno dei suoi genitori è cliccabile
                let obj = intersect.object;
                while (obj) {
                    if (obj.userData && obj.userData.isClickable) {
                        clickableObject = obj;
                        break;
                    }
                    obj = obj.parent;
                }
                if (clickableObject) break;
            }
            
            if (clickableObject) {
                // Ottieni il timestamp corrente
                const now = Date.now();
                
                // Verifica se è un doppio tap sullo stesso oggetto
                if (this.lastSelectedObject === clickableObject && 
                    now - this.lastTapTime < 500) { // 500ms per il doppio tap
                    
                    // Esegui la funzione di callback associata all'oggetto
                    if (clickableObject.userData.onClick) {
                        clickableObject.userData.onClick(clickableObject);
                    }
                    
                    // Resetta lo stato dopo l'azione
                    this.lastSelectedObject = null;
                    this.lastTapTime = 0;
                    
                    // Nascondi il tooltip dopo l'azione
                    this.hideSelectedElement();
                } else {
                    // Primo tap: mostra il nome dell'elemento selezionato
                    this.showSelectedElement(clickableObject);
                    
                    // Memorizza l'oggetto e il timestamp per il prossimo tap
                    this.lastSelectedObject = clickableObject;
                    this.lastTapTime = now;
                }
            }
        } else {
            // Nessun oggetto selezionato, nascondi il tooltip
            this.hideSelectedElement();
            this.lastSelectedObject = null;
        }
    }
    
    // Aggiorna la posizione del mouse normalizzata
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    // Esempio di come creare un oggetto cliccabile nel modello corrente
    createClickableTestModel() {
        if (!this.currentModel) {
            console.warn('Nessun modello caricato.');
            return;
        }
        
        // Rendi cliccabile la sfera nel modello di test
        if (this.currentModel) {
            // Aumentato il limite di elementi cliccabili da 50 a 500
            const maxClickableElements = 500;
            let clickableCount = 0;
            
            let sphere = null;
            this.currentModel.traverse((child) => {
                if (child.isMesh && child.geometry instanceof THREE.SphereGeometry) {
                    sphere = child;
                    // Assegna un nome alla sfera se non ne ha uno
                    if (!sphere.name || sphere.name === '') {
                        sphere.name = 'Sfera_Centrale';
                    }
                }
            });
            
            if (sphere && clickableCount < maxClickableElements) {
                this.makeObjectClickable(sphere, (obj) => {
                    alert(`Hai cliccato sulla sfera!\nPuoi definire qualsiasi azione qui.`);
                    // Esempio: cambia colore quando viene cliccato
                    if (obj.material) {
                        obj.material.color.set(Math.random() * 0xffffff);
                    }
                }, 'Clicca per cambiare il colore della {name}');
                clickableCount++;
            }
            
            // Rendi cliccabili anche i cubi
            let cubeIndex = 0;
            this.currentModel.traverse((child) => {
                if (clickableCount >= maxClickableElements) return;
                
                if (child.isMesh && child.geometry instanceof THREE.BoxGeometry) {
                    const cubeNumber = cubeIndex++;
                    // Assegna un nome al cubo se non ne ha uno
                    if (!child.name || child.name === '') {
                        child.name = `Cubo_${cubeNumber}`;
                    }
                    
                    this.makeObjectClickable(child, (obj) => {
                        alert(`Hai cliccato sul ${obj.name}!\nPuoi definire qualsiasi azione qui.`);
                        // Esempio: cambia colore quando viene cliccato
                        if (obj.material) {
                            obj.material.color.set(Math.random() * 0xffffff);
                        }
                    }, `Clicca per cambiare il colore di {name}`);
                    clickableCount++;
                }
            });
            
            // Elementi cliccabili creati senza mostrare messaggi
        }
    }
    
    // Metodo per rendere cliccabili parti specifiche di un modello
    makeModelPartsClickable(criteria = {}, onClick, tooltip = '', maxElements = Infinity) {
        if (!this.currentModel) {
            console.warn('Nessun modello caricato. Carica prima un modello.');
            return;
        }
        
        let clickableCount = 0;
        let totalMeshCount = 0;
        
        // Prima conta il numero totale di mesh nel modello
        this.currentModel.traverse((child) => {
            if (child.isMesh) {
                totalMeshCount++;
            }
        });
        
        // Attraversa tutti gli oggetti nel modello
        this.currentModel.traverse((child) => {
            // Limita il numero di elementi cliccabili
            if (clickableCount >= maxElements) return;
            let isMatch = false;
            
            // Verifica se l'oggetto corrisponde ai criteri specificati
            if (child.isMesh) {
                isMatch = true;
                
                // Verifica il nome se specificato
                if (criteria.name && !child.name.includes(criteria.name)) {
                    isMatch = false;
                }
                
                // Verifica il tipo di geometria se specificato
                if (criteria.geometryType) {
                    const geometryType = criteria.geometryType.toLowerCase();
                    if (geometryType === 'box' && !(child.geometry instanceof THREE.BoxGeometry)) {
                        isMatch = false;
                    } else if (geometryType === 'sphere' && !(child.geometry instanceof THREE.SphereGeometry)) {
                        isMatch = false;
                    } else if (geometryType === 'cylinder' && !(child.geometry instanceof THREE.CylinderGeometry)) {
                        isMatch = false;
                    } else if (geometryType === 'plane' && !(child.geometry instanceof THREE.PlaneGeometry)) {
                        isMatch = false;
                    }
                }
                
                // Verifica il colore se specificato
                if (criteria.color && child.material) {
                    const targetColor = new THREE.Color(criteria.color);
                    let colorMatch = false;
                    
                    if (Array.isArray(child.material)) {
                        // Se l'oggetto ha più materiali, verifica se almeno uno corrisponde
                        for (const mat of child.material) {
                            if (mat.color && mat.color.equals(targetColor)) {
                                colorMatch = true;
                                break;
                            }
                        }
                    } else if (child.material.color) {
                        colorMatch = child.material.color.equals(targetColor);
                    }
                    
                    if (!colorMatch) {
                        isMatch = false;
                    }
                }
                
                // Verifica la posizione se specificata
                if (criteria.position) {
                    const pos = criteria.position;
                    if (pos.x !== undefined && Math.abs(child.position.x - pos.x) > 0.1) {
                        isMatch = false;
                    }
                    if (pos.y !== undefined && Math.abs(child.position.y - pos.y) > 0.1) {
                        isMatch = false;
                    }
                    if (pos.z !== undefined && Math.abs(child.position.z - pos.z) > 0.1) {
                        isMatch = false;
                    }
                }
                
                // Verifica la dimensione se specificata
                if (criteria.size) {
                    const box = new THREE.Box3().setFromObject(child);
                    const size = box.getSize(new THREE.Vector3());
                    
                    if (criteria.size.min) {
                        const min = criteria.size.min;
                        if (min.x !== undefined && size.x < min.x) isMatch = false;
                        if (min.y !== undefined && size.y < min.y) isMatch = false;
                        if (min.z !== undefined && size.z < min.z) isMatch = false;
                    }
                    
                    if (criteria.size.max) {
                        const max = criteria.size.max;
                        if (max.x !== undefined && size.x > max.x) isMatch = false;
                        if (max.y !== undefined && size.y > max.y) isMatch = false;
                        if (max.z !== undefined && size.z > max.z) isMatch = false;
                    }
                }
                
                // Verifica funzione personalizzata se specificata
                if (criteria.customCheck && typeof criteria.customCheck === 'function') {
                    if (!criteria.customCheck(child)) {
                        isMatch = false;
                    }
                }
            } else {
                isMatch = false; // Non è una mesh
            }
            
            // Se l'oggetto corrisponde a tutti i criteri, rendilo cliccabile
            if (isMatch) {
                // Crea una funzione di callback personalizzata per ogni oggetto
                const customOnClick = (obj) => {
                    // Chiama la funzione onClick fornita dall'utente
                    if (typeof onClick === 'function') {
                        onClick(obj, clickableCount);
                    }
                };
                
                // Crea un tooltip personalizzato per ogni oggetto
                let customTooltip = tooltip;
                if (tooltip.includes('{index}')) {
                    customTooltip = tooltip.replace('{index}', clickableCount);
                }
                if (tooltip.includes('{name}')) {
                    customTooltip = customTooltip.replace('{name}', child.name);
                }
                
                // Rendi l'oggetto cliccabile
                this.makeObjectClickable(child, customOnClick, customTooltip);
                clickableCount++;
            }
        });
        
        // Calcolo statistiche senza mostrare messaggi
        const percentageClickable = totalMeshCount > 0 ? Math.round((clickableCount / totalMeshCount) * 100) : 0;
        
        // Se non ci sono elementi cliccabili, mostra un messaggio di avviso
        if (clickableCount === 0) {
            console.warn('Nessun elemento è stato reso cliccabile. Verifica che il modello contenga mesh valide.');
        }
        
        // Aggiorna la gerarchia nel menu
        this.updateHierarchyUI();
        
        return clickableCount;
    }
    
    // Aggiorna la lista degli elementi cliccabili nel menu
    updateClickableElementsList() {
        const clickableList = document.getElementById('clickableList');
        const noClickableElements = clickableList ? clickableList.querySelector('.no-clickables') : null;
        
        if (!clickableList) {
            return;
        }
        
        // Pulisci la lista esistente (ma mantieni il messaggio "no-clickables")
        const noClickablesElement = clickableList.querySelector('.no-clickables');
        clickableList.innerHTML = '';
        if (noClickablesElement) {
            clickableList.appendChild(noClickablesElement);
        }
        
        if (this.clickableObjects.length === 0) {
            if (noClickableElements) {
                noClickableElements.style.display = 'block';
            }
        } else {
            if (noClickableElements) {
                noClickableElements.style.display = 'none';
            }
            
            // Aggiungi ogni elemento cliccabile alla lista
            this.clickableObjects.forEach((obj, index) => {
                const item = document.createElement('div');
                item.className = 'clickable-item';
                
                // Nome dell'elemento (usa il nome dell'oggetto o un nome generico)
                const name = obj.name || `Elemento ${index + 1}`;
                
                item.innerHTML = `
                    <span class="clickable-name">${name}</span>
                    <div class="clickable-actions">
                        <button class="clickable-focus-btn" title="Centra vista sull'elemento">🎯</button>
                        <button class="clickable-highlight-btn" title="Evidenzia elemento">💡</button>
                        <button class="clickable-remove-btn" title="Rimuovi dalla lista cliccabili">❌</button>
                    </div>
                `;
                
                // Aggiungi event listeners per i pulsanti
                const focusBtn = item.querySelector('.clickable-focus-btn');
                const highlightBtn = item.querySelector('.clickable-highlight-btn');
                const removeBtn = item.querySelector('.clickable-remove-btn');
                
                focusBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.focusOnObject(obj);
                };
                
                highlightBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.highlightObject(obj);
                };
                
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeClickable(obj);
                    this.updateHierarchyUI();
                };
                
                // Aggiungi click sull'elemento per simulare il click sull'oggetto 3D
                item.onclick = (e) => {
                    if (!e.target.closest('button')) {
                        // Simula il click sull'oggetto
                        if (obj.userData && obj.userData.onClick) {
                            obj.userData.onClick(obj);
                        }
                    }
                };
                
                clickableList.appendChild(item);
            });
        }
    }
    
    // Centra la vista su un oggetto specifico
    focusOnObject(object) {
        if (!object) return;
        
        // Calcola il bounding box dell'oggetto
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Calcola la distanza appropriata per inquadrare l'oggetto
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        // Posiziona la camera
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        const newPosition = center.clone().sub(direction.multiplyScalar(distance));
        
        // Anima la transizione della camera
        this.animateCameraTo(newPosition, center);
    }
    
    // Evidenzia temporaneamente un oggetto
    highlightObject(object) {
        if (!object || !object.material) return;
        
        // Salva il materiale originale
        const originalMaterial = object.material;
        
        // Crea un materiale evidenziato
        const highlightMaterial = originalMaterial.clone();
        if (highlightMaterial.emissive) {
            highlightMaterial.emissive.setHex(0x444444);
        }
        
        // Applica il materiale evidenziato
        object.material = highlightMaterial;
        
        // Ripristina il materiale originale dopo 2 secondi
        setTimeout(() => {
            object.material = originalMaterial;
        }, 2000);
    }
    
    
    // Seleziona un oggetto (simula il click)
    selectObject(object) {
        if (!object) return;
        
        // Simula il click sull'oggetto se ha un handler
        if (object.userData && object.userData.onClick) {
            object.userData.onClick(object);
        } else {
            // Comportamento di default: focalizza l'oggetto
            this.focusOnObject(object);
        }
        
        console.log(`Oggetto selezionato: ${object.name || 'Senza nome'}`);
    }
    
    // Anima la camera verso una posizione e target specifici
    animateCameraTo(position, target) {
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        const duration = 1000; // 1 secondo
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpola posizione e target
            this.camera.position.lerpVectors(startPosition, position, easeProgress);
            this.controls.target.lerpVectors(startTarget, target, easeProgress);
            
            this.controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    // Carica dinamicamente i modelli dalla cartella compressor/output
    async loadDynamicModels() {
        const dynamicModelsContainer = document.getElementById('dynamicModels');
        if (!dynamicModelsContainer) return;
        
        // Pulisci il contenitore
        dynamicModelsContainer.innerHTML = '';
        
        try {
            // Legge dinamicamente i file dal file index.json
            const response = await fetch('./compressor/output/index.json');
            
            if (!response.ok) {
                throw new Error(`Errore nel caricamento dell'indice: ${response.status}`);
            }
            
            const data = await response.json();
            const knownModels = data.files || [];
            
            // Crea pulsanti per ogni modello
            knownModels.forEach(filename => {
                const button = document.createElement('button');
                button.className = 'menu-item';
                
                // Crea un nome leggibile dal filename
                const displayName = filename
                    .replace('.glb', '')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                
                button.textContent = displayName;
                button.onclick = (e) => {
                    console.log(`Click su ${displayName}`);
                    e.stopPropagation();
                    this.loadCompressorModel(filename);
                    // Chiudi tutti i menu
                    document.querySelectorAll('.menu-items').forEach(menu => {
                        menu.classList.remove('show');
                    });
                };
                
                dynamicModelsContainer.appendChild(button);
            });
            
        } catch (error) {
            console.error('Errore nel caricamento dinamico dei modelli:', error);
        }
    }
    
    // Mostra solo un livello specifico, nascondendo tutti gli altri
    showOnlyLayer(targetLayerObject) {
        if (!this.currentModel) return;
        
        // Trova il nome del layer dal targetLayerObject
        let targetLayerName = null;
        for (const [layerName, objects] of Object.entries(this.modelLayers)) {
            if (objects.includes(targetLayerObject)) {
                targetLayerName = layerName;
                break;
            }
        }
        
        if (!targetLayerName) {
            console.warn('Layer non trovato per l\'oggetto specificato');
            return;
        }
        
        // Deseleziona solo le checkbox degli altri layer (non quella del layer target)
        const hierarchyTree = document.getElementById('hierarchyTree');
        if (!hierarchyTree) {
            console.warn('Elemento hierarchyTree non trovato');
            return;
        }
        const layerNodes = hierarchyTree.querySelectorAll('.layer-node');
        layerNodes.forEach(node => {
            const layerNameSpan = node.querySelector('.layer-name');
            const checkbox = node.querySelector('.layer-checkbox');
            if (layerNameSpan && checkbox) {
                if (layerNameSpan.textContent === targetLayerName) {
                    // Mantieni selezionata la checkbox del layer target
                    checkbox.checked = true;
                } else {
                    // Deseleziona le checkbox degli altri layer
                    checkbox.checked = false;
                }
            }
        });
        
        // Nascondi tutti gli oggetti di tutti i layer
        Object.values(this.modelLayers).forEach(layerObjects => {
            layerObjects.forEach(obj => {
                obj.visible = false;
            });
        });
        
        // Mostra solo gli oggetti del layer target
        this.modelLayers[targetLayerName].forEach(obj => {
            obj.visible = true;
        });
        
        console.log(`Mostrato solo il livello: ${targetLayerName}`);
    }
    
    // Ripristina la visibilità di tutti i livelli
    showAllLayers() {
        if (!this.currentModel) return;
        
        // Riseleziona tutte le checkbox dei layer
        const layerCheckboxes = document.querySelectorAll('.layer-checkbox');
        layerCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        
        Object.values(this.modelLayers).forEach(layerObjects => {
            layerObjects.forEach(obj => {
                obj.visible = true;
            });
        });
        
        console.log('Ripristinata la visibilità di tutti i livelli');
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Check memory periodically (every 5 seconds)
        const now = Date.now();
        if (now - this.lastMemoryCheck > 5000) {
            this.lastMemoryCheck = now;
            if ('memory' in performance && this.currentModel) {
                const memInfo = performance.memory;
                const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
                const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
                const usagePercent = (usedMB / limitMB) * 100;
                
                if (usagePercent > 85) {
                    console.warn(`Memoria critica: ${usagePercent.toFixed(1)}% utilizzata`);
                }
            }
        }
        
        // Check for intersections with clickable objects
        this.checkIntersections();
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    // Metodo per rilevare se un modello GLTF usa la compressione Draco
    detectDracoCompression(gltf) {
        if (!gltf || !gltf.parser || !gltf.parser.json) {
            return false;
        }
        
        const json = gltf.parser.json;
        
        // Controlla se ci sono estensioni Draco
        if (json.extensionsUsed && json.extensionsUsed.includes('KHR_draco_mesh_compression')) {
            return true;
        }
        
        // Controlla se ci sono primitive con compressione Draco
        if (json.meshes) {
            for (const mesh of json.meshes) {
                if (mesh.primitives) {
                    for (const primitive of mesh.primitives) {
                        if (primitive.extensions && primitive.extensions['KHR_draco_mesh_compression']) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const viewer = new ModelViewer();
    
    // Hide instructions after 5 seconds
    setTimeout(() => {
        const instructions = document.getElementById('instructions');
        if (instructions && !document.getElementById('loading').classList.contains('hidden')) {
            instructions.style.opacity = '0.7';
        }
    }, 5000);
    
    // Meccanismo di sicurezza per assicurarsi che il loader non rimanga visibile
    // quando non dovrebbe esserlo
    setInterval(() => {
        const loading = document.getElementById('loading');
        const isModelLoaded = viewer.currentModel !== null;
        const isLoaderVisible = loading && !loading.classList.contains('hidden');
        
        // Se c'è un modello caricato ma il loader è ancora visibile, lo nascondiamo
        if (isModelLoaded && isLoaderVisible) {
            console.warn('Rilevato loader visibile con modello già caricato. Correzione automatica...');
            loading.classList.add('hidden');
        }
    }, 2000); // Controlla ogni 2 secondi
});

// Handle fullscreen changes
document.addEventListener('fullscreenchange', () => {
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
});

// Prevent default touch behaviors that might interfere
document.addEventListener('touchstart', (e) => {
    if (e.target.closest('#three-canvas')) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#three-canvas')) {
        e.preventDefault();
    }
}, { passive: false });