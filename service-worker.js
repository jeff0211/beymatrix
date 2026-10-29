const CACHE_NAME = 'beymatrix-shell-v1';
const RUNTIME_CACHE_NAME = 'beymatrix-runtime-v1';
const CACHEABLE_EXTERNAL_ORIGINS = new Set([
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
]);
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName =>
                        (cacheName.startsWith('beymatrix-shell-') && cacheName !== CACHE_NAME) ||
                        (cacheName.startsWith('beymatrix-runtime-') && cacheName !== RUNTIME_CACHE_NAME)
                    )
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    if (request.method !== 'GET') {
        return;
    }

    if (requestUrl.origin !== self.location.origin) {
        if (!CACHEABLE_EXTERNAL_ORIGINS.has(requestUrl.origin)) {
            return;
        }

        event.respondWith((async () => {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) return cachedResponse;

            try {
                const response = await fetch(request);
                if (response.ok || response.type === 'opaque') {
                    try {
                        const cache = await caches.open(RUNTIME_CACHE_NAME);
                        await cache.put(request, response.clone());
                    } catch (error) {
                        console.error('Unable to cache an offline style resource.', error);
                    }
                }
                return response;
            } catch (error) {
                const fallbackResponse = await caches.match(request);
                if (fallbackResponse) return fallbackResponse;
                throw error;
            }
        })());
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const responseCopy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', responseCopy));
                    }
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(cachedResponse => cachedResponse || fetch(request).then(response => {
                if (response.ok) {
                    const responseCopy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseCopy));
                }
                return response;
            }))
    );
});
