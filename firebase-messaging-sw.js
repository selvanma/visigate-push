importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

try {
  importScripts(new URL('firebase-config.js', self.location.href).href);
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Firebase config file unavailable; using embedded project config.', e);
}

if (!firebase.apps.length) {
  firebase.initializeApp(typeof firebaseConfig !== 'undefined' ? firebaseConfig : {
    apiKey: 'AIzaSyA2-swVhNnTLaLXLs3eKrM_1opcQvq9HNE',
    authDomain: 'visigate-alerts.firebaseapp.com',
    projectId: 'visigate-alerts',
    storageBucket: 'visigate-alerts.appspot.com',
    messagingSenderId: '888768950377',
    appId: '1:888768950377:web:d6ad945e4ed9b78c2832f8'
  });
}

const messaging = firebase.messaging();

/**
 * BACKGROUND FCM WEBPUSH MESSAGE HANDLER
 * Handles:
 * 1. High-Resolution Visitor Camera Photos (image property)
 * 2. Life-Safety Emergency Codes (911 Medical, 912 Fire, 913 Security, 914 Lift)
 *    with persistent lock-screen display (requireInteraction: true) and continuous vibration.
 * Resident decisions and barrier controls stay in the authenticated app until their
 * server-side authorization handlers are available.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Incoming WebPush Payload:', payload);

  const notif = payload.notification || {};
  const data = payload.data || {};

  const isEmergency = data.emergencyCode || (notif.title && notif.title.includes('EMERGENCY'));
  const emergencyCode = data.emergencyCode || '911';

  let title = notif.title || (isEmergency ? `🚨 EMERGENCY CODE [${emergencyCode}] ALERT` : '🛡️ VisiGate Gate Alert');
  let body = notif.body || 'New Gate Clearance Request';
  let photoUrl = notif.image || data.image || null;
  let iconUrl = notif.icon || data.icon || 'https://img.icons8.com/color/96/security-gate.png';
  let badgeUrl = 'https://img.icons8.com/color/48/shield.png';

  let requireInteraction = false;
  let vibratePattern = [200, 100, 200];

  if (isEmergency) {
    // Keep emergency alerts visible until opened; the app handles authorized response.
    requireInteraction = true;
    vibratePattern = [500, 200, 500, 200, 500, 200, 1000];
  }

  const notificationOptions = {
    body: body,
    icon: iconUrl,
    image: photoUrl, // Rich Visitor Camera Snapshot
    badge: badgeUrl,
    requireInteraction: requireInteraction,
    renotify: true,
    tag: isEmergency ? `vg_emergency_${emergencyCode}` : (data.passId || 'vg_gate_alert'),
    vibrate: vibratePattern,
    actions: [],
    data: {
      passId: data.passId || 'PASS-' + Date.now(),
      soc: data.soc || 'DEMO',
      emergencyCode: emergencyCode,
      isEmergency: isEmergency,
      flat: data.flat || 'Tower B - Flat 402',
      gate: data.gate || 'Gate 1',
      url: data.click_action || 'demo.html'
    }
  };

  // Broadcast emergency signal to any open guard/resident tabs so they sound audio siren
  if (isEmergency) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'EMERGENCY_SIREN_TRIGGER',
          code: emergencyCode,
          flat: data.flat || 'Tower B - Flat 402',
          title: title,
          body: body
        });
      });
    });
  }

  return self.registration.showNotification(title, notificationOptions);
});

/**
 * Notification clicks open the app on the same origin. Privileged decisions
 * require the app's authenticated flow.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  let targetUrl = new URL('demo.html', self.registration.scope).href;
  try {
    const requestedUrl = new URL(notifData.url || 'demo.html', self.registration.scope);
    if (requestedUrl.origin === self.location.origin && requestedUrl.href.startsWith(self.registration.scope)) {
      targetUrl = requestedUrl.href;
    }
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Ignoring invalid notification URL:', err);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (new URL(client.url).origin === self.location.origin &&
            client.url.startsWith(self.registration.scope) &&
            'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then((navigatedClient) => {
              return (navigatedClient || client).focus();
            });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
