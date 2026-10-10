importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA2-swVhNnTLaLXLs3eKrM_1opcQvq9HNE",
  authDomain: "visigate-alerts.firebaseapp.com",
  projectId: "visigate-alerts",
  storageBucket: "visigate-alerts.appspot.com",
  messagingSenderId: "888768950377",
  appId: "1:888768950377:web:d6ad945e4ed9b78c2832f8"
});

const messaging = firebase.messaging();
