class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentModel = null;
        this.isWireframe = false;
        this.lastMemoryCheck = 0;
        this.raycaster = null;
        this.mouse = null;
        this.clickableObjects = [];
        this.hoveredObject = null;
        this.modelLayers = {}; // Oggetto per memorizzare i layer del modello
        this.layerColors = {}; // Colori associati ai layer
        this.aggressiveOptimizationsEnabled = true; // Flag per controllare le ottimizzazioni aggressive
        
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
        
        this.updateLayersUI();
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
    
    updateLayersUI() {
        const layersList = document.getElementById('layersList');
        const noLayersMsg = layersList.querySelector('.no-layers');
        
        // Rimuovi il messaggio "nessun layer"
        if (noLayersMsg) {
            noLayersMsg.remove();
        }
        
        // Pulisci la lista esistente
        layersList.innerHTML = '';
        
        // Se non ci sono layer, mostra il messaggio
        if (Object.keys(this.modelLayers).length === 0) {
            layersList.innerHTML = '<p class="no-layers">Nessun layer disponibile</p>';
            return;
        }
        
        // Aggiungi ogni layer alla lista
        Object.keys(this.modelLayers).forEach(layerName => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'layer-checkbox';
            checkbox.checked = true;
            checkbox.addEventListener('change', (e) => {
                this.toggleLayerVisibility(layerName, e.target.checked);
            });
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = `${layerName} (${this.modelLayers[layerName].length})`;
            
            const colorDiv = document.createElement('div');
            colorDiv.className = 'layer-color';
            colorDiv.style.backgroundColor = this.layerColors[layerName];
            
            layerItem.appendChild(checkbox);
            layerItem.appendChild(nameSpan);
            layerItem.appendChild(colorDiv);
            
            layersList.appendChild(layerItem);
        });
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
        
        // Setup scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);
        
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
        const testModelBtn = document.getElementById('testModelBtn');
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
            const testModelBtn = document.getElementById('testModelBtn');
            const engineModelBtn = document.getElementById('engineModelBtn');
            // Rimossa dichiarazione s3ModelBtn
            
            if (uploadModelBtn) {
                uploadModelBtn.onclick = (e) => {
                    console.log('Click su Carica File');
                    e.stopPropagation();
                    this.fileInput.click();
                    closeAllMenus();
                };
            }
            
            if (testModelBtn) {
                testModelBtn.onclick = (e) => {
                    console.log('Click su Modello Test');
                    e.stopPropagation();
                    this.loadTestModel();
                    closeAllMenus();
                };
            }
            
            if (engineModelBtn) {
                engineModelBtn.onclick = (e) => {
                    console.log('Click su Motore V8');
                    e.stopPropagation();
                    this.loadExampleGlbModel();
                    closeAllMenus();
                };
            }
            
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
            const optimizationsBtn = document.getElementById('optimizationsBtn');
            
            if (resetViewBtn) {
                resetViewBtn.onclick = function(e) {
                    console.log('Click su Reset Vista');
                    e.stopPropagation();
                    resetView();
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
        } else {
            console.error('Elementi menu Impostazioni non trovati');
        }
        
        // Gestione menu "Layer"
        const layersBtn = document.getElementById('layersButton');
        const layersItems = document.getElementById('layersItems');
        
        if (layersBtn && layersItems) {
            console.log('Configurazione menu Layer');
            
            // Gestione click sul pulsante principale
            layersBtn.onclick = function(e) {
                console.log('CLICK su Layer');
                e.stopPropagation();
                
                // Chiudi tutti gli altri menu
                document.querySelectorAll('.menu-items').forEach(menu => {
                    if (menu !== layersItems) {
                        menu.classList.remove('show');
                    }
                });
                
                // Apri/chiudi questo menu
                layersItems.classList.toggle('show');
                console.log('Menu Layer cliccato, Stato:', layersItems.classList.contains('show'));
            };
            
            // Previeni la chiusura quando si clicca all'interno del menu
            layersItems.onclick = function(e) {
                console.log('Click dentro layersItems');
                e.stopPropagation();
            };
        } else {
            console.error('Elementi menu Layer non trovati');
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
                
                console.log('File selezionato:', file.name);
                
                const fileName = file.name.toLowerCase();
                console.log('Elaborazione file:', fileName);
                
                if (fileName.endsWith('.fbx')) {
                     this.loadFBXModel(file);
                 } else if (fileName.endsWith('.obj')) {
                     this.loadOBJModel(file);
                 } else if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
                     this.loadGLTFModel(file);
                 } else {
                     alert('Per favore seleziona un file 3D valido (.fbx, .obj, .gltf, .glb).');
                 }
            });
        } else {
            console.warn('Input file non trovato');
        }
    }
    
    loadTestModel() {
        const loading = document.getElementById('loading');
        const instructions = document.getElementById('instructions');
        
        loading.classList.remove('hidden');
        instructions.style.display = 'none';
        
        // Remove existing model
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // Resetta la lista degli oggetti cliccabili quando si carica un nuovo modello
        this.clickableObjects = [];
        
        // Create a test 3D model (complex geometry)
        const group = new THREE.Group();
        
        // Main cube
        const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
        const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x2196F3 });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.castShadow = true;
        cube.receiveShadow = true;
        cube.name = 'Cubo_Principale';
        group.add(cube);
        
        // Smaller cubes around
        for (let i = 0; i < 8; i++) {
            const smallCube = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.5, 0.5),
                new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff })
            );
            const angle = (i / 8) * Math.PI * 2;
            smallCube.position.set(
                Math.cos(angle) * 3,
                Math.sin(angle * 2) * 1.5,
                Math.sin(angle) * 3
            );
            smallCube.castShadow = true;
            smallCube.receiveShadow = true;
            smallCube.name = `Cubo_${i+1}`;
            group.add(smallCube);
        }
        
        // Sphere
        const sphereGeometry = new THREE.SphereGeometry(0.8, 32, 32);
        const sphereMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff6b35,
            transparent: true,
            opacity: 0.8
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(0, 3, 0);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        sphere.name = 'Sfera_Centrale';
        group.add(sphere);
        
        this.currentModel = group;
        this.scene.add(group);
        
        // Crea i layer dal modello di test
        console.log('Creazione layer dal modello di test...');
        this.createLayersFromModel(group);
        
        // Reset camera position
        this.resetView();
        
        console.log('Nascondendo il loader nel loadTestModel...');
        loading.classList.add('hidden');
        console.log('Loader nascosto nel loadTestModel:', loading.classList.contains('hidden'));
        instructions.style.display = 'block';
        
        // Verifica che il loader sia effettivamente nascosto
        setTimeout(() => {
            const loaderElement = document.getElementById('loading');
            if (loaderElement && !loaderElement.classList.contains('hidden')) {
                console.error('Il loader è ancora visibile dopo il caricamento del modello di test!');
                loaderElement.classList.add('hidden');
            }
        }, 1000);
        
        console.log('Modello di test caricato con successo!');
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
                return null;
            }
        }
        
        if (fileSizeMB > 500) {
            alert(`File troppo grande (${fileSizeMB.toFixed(2)} MB). Il limite massimo è 500MB. Si consiglia di utilizzare file sotto i 100MB per prestazioni ottimali su dispositivi mobili.`);
            console.log('File troppo grande, caricamento annullato');
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
            background: #2196F3;
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
                
                // Implementa LOD per modelli critici
                console.log('Implementando Level of Detail (LOD) per modello critico...');
                this.setupSimpleLOD(object);
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
            
            // Mostra un messaggio informativo all'utente
            const modelInfo = document.createElement('div');
            modelInfo.className = 'model-info';
            modelInfo.innerHTML = `
                <h3>Modello ${modelType} caricato con successo!</h3>
                <button id="close-info">Chiudi</button>
            `;
            document.body.appendChild(modelInfo);
            
            // Aggiungi stile per il messaggio informativo se non esiste già
            if (!document.getElementById('model-info-style')) {
                const style = document.createElement('style');
                style.id = 'model-info-style';
                style.textContent = `
                    .model-info {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                        padding: 15px;
                        border-radius: 5px;
                        max-width: 350px;
                        z-index: 1000;
                        font-size: 14px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    }
                    .model-info h3 {
                        margin-top: 0;
                        color: #4CAF50;
                    }
                    .model-info button {
                        background: #4CAF50;
                        border: none;
                        color: white;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                        margin-top: 10px;
                    }
                    .model-info button:hover {
                        background: #45a049;
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Aggiungi event listener per chiudere il messaggio
            document.getElementById('close-info').addEventListener('click', () => {
                document.body.removeChild(modelInfo);
            });
            
            // Chiudi automaticamente il messaggio dopo 10 secondi
            setTimeout(() => {
                if (document.body.contains(modelInfo)) {
                    document.body.removeChild(modelInfo);
                }
            }, 10000);
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
        
        // Clean up progress bar and URL
        if (progressBar.parentNode) {
            progressBar.parentNode.removeChild(progressBar);
        }
        URL.revokeObjectURL(url);
        
        // Reset loading text
        loadingText.innerHTML = 'Caricamento modello...';
        
        // Se il loader non è disponibile, suggerisci il modello di test
        if (error.message.includes(`${loaderName} non disponibile`)) {
            setTimeout(() => {
                if (confirm('Vuoi caricare un modello di test per vedere come funziona l\'applicazione?')) {
                    this.loadTestModel();
                }
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
    
    loadExampleGlbModel() {
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
            background: #2196F3;
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
        
        const loadingInfo = {
            loading,
            instructions,
            loadingText,
            progressBar,
            progressFill,
            fileSizeMB: 5 // Dimensione stimata del file
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
            alert('Errore durante l\'inizializzazione di GLTFLoader: ' + e.message);
            loading.classList.add('hidden');
            instructions.style.display = 'block';
        }
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
                        // Rimuovi attributi non essenziali per risparmiare memoria
                        ['color', 'uv2', 'tangent', 'bitangent'].forEach(attr => {
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
            
            // Implementa LOD per modelli critici
            this.setupSimpleLOD(this.currentModel);
            
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
                        // Rimuovi attributi non essenziali per risparmiare memoria
                        ['color', 'tangent'].forEach(attr => {
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
    
    // Riduce la risoluzione di una texture
    reduceTextureResolution(texture, scale) {
        if (!texture || !texture.image) return;
        
        // Crea un canvas temporaneo per ridimensionare l'immagine
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calcola le nuove dimensioni
        const newWidth = Math.max(32, Math.floor(texture.image.width * scale));
        const newHeight = Math.max(32, Math.floor(texture.image.height * scale));
        
        // Imposta le dimensioni del canvas
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Disegna l'immagine ridimensionata sul canvas
        ctx.drawImage(texture.image, 0, 0, newWidth, newHeight);
        
        // Aggiorna la texture con l'immagine ridimensionata
        texture.image = canvas;
        texture.needsUpdate = true;
        
        console.log(`Texture ridimensionata da ${texture.image.width}x${texture.image.height} a ${newWidth}x${newHeight}`);
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
        
        // Ottimizzazione dinamica del frustum culling per modelli grandi
        if (this.currentModel && this.modelSizeMB > 100) {
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
    
    // Gestione del touch
    onTouchStart(event) {
        // Previeni il touch se ci sono più di un tocco (probabilmente è un gesto di zoom/pan)
        if (event.touches.length > 1) return;
        
        // Converti il touch in coordinate del mouse
        const touch = event.touches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        
        this.updateMousePosition(mouseEvent);
        this.onMouseClick(mouseEvent);
    }
    
    // Aggiorna la posizione del mouse normalizzata
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    // Esempio di come creare un oggetto cliccabile nel modello di test
    createClickableTestModel() {
        this.loadTestModel();
        
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
        
        return clickableCount;
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