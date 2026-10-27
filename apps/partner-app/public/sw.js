/*
 * Partner App web version: the service worker that makes it installable on browsers that still
 * require one with a fetch handler. Nothing is cached, so every deploy is picked up straight away;
 * a page load without a connection gets a short offline notice instead of the browser's error.
 */

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lot More Wins Partner</title>
    <style>
      html, body { height: 100%; margin: 0; background: #750505; color: #F5EDE0; font-family: system-ui, sans-serif; }
      body { display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; box-sizing: border-box; }
      button { margin-top: 20px; padding: 12px 24px; border: 0; border-radius: 12px; background: #F5C542; color: #1A0A0D; font-weight: 600; font-size: 15px; }
    </style>
  </head>
  <body>
    <div>
      <h1 style="font-size: 20px">You are offline</h1>
      <p style="color: #EBB8B0">Connect to the internet to use the Partner App.</p>
      <button onclick="location.reload()">Try again</button>
    </div>
  </body>
</html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    )
  );
});
