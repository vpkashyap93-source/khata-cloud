// Network-first app-shell cache. Same-origin GET requests only - Firestore
// and Auth calls (a different origin) are never touched, so they keep
// using the Firestore SDK's own offline queue/cache instead of this one.
// Network-first (not cache-first) so a logged-in user always gets the
// latest app code when online; the cache only kicks in once offline.
const CACHE_NAME = 'khata-cloud-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([self.registration.scope]))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match(self.registration.scope))
      )
  )
})
