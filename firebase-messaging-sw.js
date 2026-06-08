// firebase-messaging-sw.js
// Debe estar en la RAÍZ del hosting (mismo nivel que index.html)
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDQEMeKa8yGsdvyW3qoC9w1ITMCzNN0TTI",
  authDomain: "sura-asesor.firebaseapp.com",
  projectId: "sura-asesor",
  storageBucket: "sura-asesor.firebasestorage.app",
  messagingSenderId: "910746092866",
  appId: "1:910746092866:web:ae7bd2b56615b2779d74db"
});

const messaging = firebase.messaging();

// Manejar notificaciones cuando la app está en segundo plano o cerrada
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '🏥 SURA Asesor', {
    body:      body || '',
    icon:      icon || '/sura-asesor/Seguros_SURA_Logo.svg',
    badge:     '/sura-asesor/Seguros_SURA_Logo.svg',
    tag:       'sura-renovacion',
    renotify:  true,
    data:      payload.data || {}
  });
});

// Al hacer clic en la notificación → abrir/enfocar la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c =>
        c.url.includes('sura-asesor') || c.url.includes('localhost')
      );
      if (existing) return existing.focus();
      return clients.openWindow('/sura-asesor/');
    })
  );
});
