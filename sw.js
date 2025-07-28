const CACHE_VERSION = '1.0.2';
const CACHE_NAME = `model-viewer-v${CACHE_VERSION}`;
const STATIC_CACHE = `static-cache-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-cache-v${CACHE_VERSION}`;
const MODEL_CACHE = `model-cache-v${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './offline.svg',
  './styles.css',
  './app.js',
  './mobile.js',
  './cache-buster.js',
  './manifest.json',
  './browserconfig.xml',
  './icon-192x192.png',
  './icon-512x512.svg',
  './screenshot-wide.svg',
  './screenshot-narrow.svg',
  './disassembled_v8_engine_block.glb'
];

const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/fflate@0.7.4/umd/index.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

const ALL_ASSETS = [...STATIC_ASSETS, ...EXTERNAL_ASSETS];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE)
        .then(cache => {
          console.log('Service Worker: Caching static files');
          return cache.addAll(STATIC_ASSETS);
        }),
      // Cache external libraries
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          console.log('Service Worker: Caching external libraries');
          return cache.addAll(EXTERNAL_ASSETS);
        })
    ])
    .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, MODEL_CACHE, CACHE_NAME];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!currentCaches.includes(cacheName)) {
              console.log('SW: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated and controlling clients');
        return self.clients.claim();
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting phase');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Service Worker: Clearing all caches');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// Fetch event - serve from cache or network with improved strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Handle different types of requests differently
  const url = new URL(event.request.url);
  
  // Strategy for versioned files (always fetch fresh if version parameter exists)
  if (url.searchParams.has('v') || url.searchParams.has('t')) {
    event.respondWith(networkFirstStrategy(event.request, STATIC_CACHE));
    return;
  }
  
  // Strategy for static assets (cache first, then network)
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.png') || 
      url.pathname.endsWith('.svg') || 
      url.pathname.endsWith('.json')) {
    event.respondWith(cacheFirstStrategy(event.request, STATIC_CACHE));
    return;
  }
  
  // Strategy for external libraries (cache first with longer max-age)
  if (EXTERNAL_ASSETS.includes(event.request.url) || 
      event.request.url.includes('cdn.jsdelivr.net') || 
      event.request.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirstStrategy(event.request, STATIC_CACHE));
    return;
  }
  
  // Strategy for 3D models (network first, then cache)
  if (url.pathname.endsWith('.glb') || 
      url.pathname.endsWith('.gltf') || 
      url.pathname.endsWith('.obj')) {
    event.respondWith(networkFirstStrategy(event.request, MODEL_CACHE));
    return;
  }
  
  // Skip FBX files (they can be large and we don't want to cache them)
  if (url.pathname.endsWith('.fbx')) return;
  
  // Default strategy for everything else (network first with fallback to cache)
  event.respondWith(networkFirstStrategy(event.request, DYNAMIC_CACHE));
});

// Cache-first strategy: try cache first, then network
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Not in cache, get from network
    const networkResponse = await fetch(request);
    if (!networkResponse || networkResponse.status !== 200) {
      return networkResponse;
    }
    
    // Cache the response for future
    const responseToCache = networkResponse.clone();
    const cache = await caches.open(cacheName);
    cache.put(request, responseToCache);
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache-first strategy failed', error);
    throw error;
  }
}

// Network-first strategy: try network first, then cache
async function networkFirstStrategy(request, cacheName) {
  try {
    // Try to get from network first
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Cache the response for offline use
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, responseToCache);
      
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Network request failed, trying cache', error);
  }
  
  // If network fails, try from cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If both network and cache fail, return a custom offline response
  const acceptHeader = request.headers.get('accept') || '';

  if (acceptHeader.includes('text/html')) {
    return caches.match('/offline.html');
  }

  // For images, return offline image
  if (acceptHeader.includes('image/')) {
    return caches.match('/offline.svg');
  }
  
  // For other resources, just let it fail
  throw new Error('Service Worker: Resource not available offline');
}

// Handle background sync for offline functionality
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background tasks here
      Promise.resolve()
    );
  }
});

// Handle push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'Notifica da 3D Viewer',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Apri App',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: '/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('3D Model Viewer', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker: Error occurred', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection', event.reason);
});