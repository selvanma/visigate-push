importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

try {
  importScripts('/firebase-config.js');
} catch(e) {}

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
 * 2. Resident 1-Tap Lock-Screen Response Action Buttons (Approve / Deny / Locker)
 * 3. Life-Safety Emergency Codes (911 Medical, 912 Fire, 913 Security, 914 Lift)
 *    with persistent lock-screen display (requireInteraction: true) and continuous vibration.
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

  let actions = [];
  let requireInteraction = false;
  let vibratePattern = [200, 100, 200];

  if (isEmergency) {
    // Emergency 911 to 914: Persistent lock-screen, audible pulse, barrier override
    requireInteraction = true;
    vibratePattern = [500, 200, 500, 200, 500, 200, 1000];

    actions = [
      { action: 'EMERGENCY_RAISE_ALL', title: '🟢 Raise All Barriers (Emergency Entry)' },
      { action: 'CALL_FLAT', title: '📞 Call Resident Intercom' },
      { action: 'DISPATCH_GUARD', title: '🏃 Dispatch Patrol Guard to Flat' }
    ];
  } else {
    // Normal Visitor Entry with Direct Resident Decision Buttons
    actions = [
      { action: 'APPROVE_ENTRY', title: '✓ Approve & Raise Barrier' },
      { action: 'DENY_ENTRY', title: '✕ Deny Entry' },
      { action: 'GATE_LOCKER', title: '📦 Keep at Gate Locker' }
    ];
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
    actions: actions,
    data: {
      passId: data.passId || 'PASS-' + Date.now(),
      soc: data.soc || 'DEMO',
      emergencyCode: emergencyCode,
      isEmergency: isEmergency,
      flat: data.flat || 'Tower B - Flat 402',
      gate: data.gate || 'Gate 1',
      url: data.click_action || '/demo.html'
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
 * NOTIFICATION CLICK & ACTION BUTTON LISTENER
 * Enables resident to respond (Approve / Deny / Locker) directly from lock screen
 * without needing to open the browser tab or app.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const passId = notifData.passId;
  const soc = notifData.soc || 'DEMO';
  const targetUrl = notifData.url || '/demo.html';

  console.log('[firebase-messaging-sw.js] User tapped action:', action, 'Pass ID:', passId);

  if (action === 'APPROVE_ENTRY' || action === 'DENY_ENTRY' || action === 'GATE_LOCKER') {
    // 1-Tap Resident Action: Send background decision to Master Router
    const routerEndpoint = `https://script.google.com/macros/s/AKfycbwz-eVMRCO7Sd1dGIIVkHgmBXvfTxrbou5WX_lR2bIx3mKocZUAjWbqI_CuSy_dSw3-/exec?action=RECORD_DECISION&soc=${soc}&passId=${passId}&decision=${action}`;

    event.waitUntil(
      fetch(routerEndpoint, { method: 'POST', mode: 'no-cors' })
        .then(() => {
          console.log('[firebase-messaging-sw.js] Successfully recorded resident response in Master Router:', action);
        })
        .catch((err) => {
          console.error('[firebase-messaging-sw.js] Error recording decision:', err);
        })
    );
  } else if (action === 'EMERGENCY_RAISE_ALL') {
    // Emergency Action: Immediately broadcast barrier lift to Master Router
    const emergencyEndpoint = `https://script.google.com/macros/s/AKfycbwz-eVMRCO7Sd1dGIIVkHgmBXvfTxrbou5WX_lR2bIx3mKocZUAjWbqI_CuSy_dSw3-/exec?action=EMERGENCY_LIFT_BARRIER&soc=${soc}&code=${notifData.emergencyCode}`;

    event.waitUntil(
      fetch(emergencyEndpoint, { method: 'POST', mode: 'no-cors' })
        .then(() => console.log('[firebase-messaging-sw.js] Emergency barrier lift signal dispatched'))
    );
  } else {
    // Clicked notification body -> Bring existing tab to focus or open new window
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes('visigate') && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
    );
  }
});
