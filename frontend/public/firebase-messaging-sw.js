// ================================================================
// PREENCHA COM AS SUAS CREDENCIAIS DO FIREBASE
// Veja MANUAL_FIREBASE.md para instruções completas
// ================================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJECT_ID.firebaseapp.com",
  projectId:         "SEU_PROJECT_ID",
  storageBucket:     "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Dr. Coxinha';
  const body  = payload.notification?.body  || '';
  self.registration.showNotification(title, {
    body,
    icon:  '/imagens/logo dr.coxinha app.png',
    badge: '/imagens/logo dr.coxinha app.png',
    data:  payload.data || {}
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = e.notification.data?.link || '/';
  e.waitUntil(clients.openWindow(link));
});
