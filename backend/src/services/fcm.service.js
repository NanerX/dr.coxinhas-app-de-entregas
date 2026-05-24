let messaging = null;

function init(serviceAccount) {
  try {
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    messaging = admin.messaging();
    console.log('[FCM] Firebase Admin inicializado com sucesso');
  } catch (err) {
    console.warn('[FCM] Falha ao inicializar Firebase Admin:', err.message);
  }
}

function isReady() {
  return messaging !== null;
}

async function sendToToken(fcmToken, title, body, data = {}) {
  if (!messaging) return { success: false, error: 'FCM não inicializado' };
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: { fcmOptions: { link: data.link || '/' } }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendToMultiple(fcmTokens, title, body, data = {}) {
  if (!messaging || !fcmTokens.length) {
    return { successCount: 0, failureCount: fcmTokens.length };
  }
  try {
    const result = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: { fcmOptions: { link: data.link || '/' } }
    });
    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      responses: result.responses
    };
  } catch (err) {
    return { successCount: 0, failureCount: fcmTokens.length, error: err.message };
  }
}

module.exports = { init, isReady, sendToToken, sendToMultiple };
