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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = (payload && payload.notification && payload.notification.title) || 'VisiGate Alert';
  const notificationOptions = {
    body: (payload && payload.notification && payload.notification.body) || 'New update from Gate',
    icon: 'https://img.icons8.com/color/48/security-gate.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
