/**
 * NOTIFICAÇÕES PUSH (FCM) — cliente
 * Inicializa Firebase, pede permissão de forma elegante
 * e registra/vincula token ao pedido no backend.
 */
(() => {
  let firebaseApp = null;
  let messaging = null;
  let inicializado = false;
  const STORAGE_TOKEN = 'dc_fcm_token';
  const STORAGE_PERMISSAO = 'dc_fcm_permissao_pedida';
  const STORAGE_DEVICE_ID = 'dc_device_id';

  function configurado() {
    return window.FIREBASE_CONFIG &&
           window.FIREBASE_CONFIG.apiKey &&
           !window.FIREBASE_CONFIG.apiKey.startsWith('SUA_') &&
           window.FCM_VAPID_KEY &&
           !window.FCM_VAPID_KEY.startsWith('SUA_');
  }

  function gerarDeviceId() {
    let id = localStorage.getItem(STORAGE_DEVICE_ID);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_DEVICE_ID, id);
    }
    return id;
  }

  async function carregarFirebaseSDK() {
    if (window.firebase) return window.firebase;
    return new Promise((resolve, reject) => {
      const s1 = document.createElement('script');
      s1.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js';
        s2.onload = () => resolve(window.firebase);
        s2.onerror = reject;
        document.head.appendChild(s2);
      };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }

  async function inicializar() {
    if (inicializado) return;
    if (!configurado()) {
      console.log('[Push] Firebase não configurado — push desativado.');
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    try {
      await carregarFirebaseSDK();
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
      } else {
        firebaseApp = firebase.app();
      }
      messaging = firebase.messaging();

      messaging.onMessage((payload) => {
        mostrarToastPush(
          payload.notification?.title || 'Dr. Coxinha',
          payload.notification?.body || '',
          payload.data?.link || '/'
        );
      });

      inicializado = true;
    } catch (e) {
      console.warn('[Push] Erro ao inicializar Firebase:', e);
    }
  }

  async function pedirPermissao(pedidoToken) {
    await inicializar();
    if (!messaging) return null;
    try {
      const permission = await Notification.requestPermission();
      localStorage.setItem(STORAGE_PERMISSAO, '1');
      if (permission !== 'granted') return null;
      return await registrarTokenAtual(pedidoToken);
    } catch (e) {
      console.warn('[Push] Erro ao pedir permissão:', e);
      return null;
    }
  }

  async function registrarTokenAtual(pedidoToken) {
    if (!messaging) await inicializar();
    if (!messaging) return null;
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await messaging.getToken({
        vapidKey: window.FCM_VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      if (!token) return null;

      localStorage.setItem(STORAGE_TOKEN, token);

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken: token,
          deviceId: gerarDeviceId()
        })
      });

      if (pedidoToken) {
        await fetch('/api/notifications/track-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fcmToken: token,
            orderToken: pedidoToken
          })
        });
      }

      console.log('[Push] Token registrado');
      return token;
    } catch (e) {
      console.warn('[Push] Falha ao registrar token:', e);
      return null;
    }
  }

  function mostrarBannerPermissao(opcoes = {}) {
    const { pedidoToken, persistente } = opcoes;
    if (!configurado()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    if (!persistente && localStorage.getItem(STORAGE_PERMISSAO) === '1') return;
    if (document.getElementById('push-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'push-banner';
    banner.style.cssText = `
      position: fixed; bottom: 16px; left: 50%;
      transform: translateX(-50%) translateY(120%);
      background: white; border: 1px solid #ffe0cc;
      box-shadow: 0 12px 40px rgba(255,102,0,0.25);
      border-radius: 18px; padding: 14px 18px;
      display: flex; align-items: center; gap: 12px;
      max-width: 92vw; width: 380px; z-index: 9999;
      font-family: var(--fonte, sans-serif);
      transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    banner.innerHTML = `
      <div style="font-size:1.8rem;flex-shrink:0;">🔔</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;color:#cc5200;font-size:0.9rem;margin-bottom:2px;">Receber atualizações?</div>
        <div style="font-size:0.76rem;color:#666;line-height:1.3;">Acompanhe seus pedidos e promoções em tempo real.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
        <button id="push-banner-ativar" style="background:linear-gradient(135deg,#ff6600,#cc5200);color:white;border:none;padding:7px 14px;border-radius:10px;font-weight:700;font-size:0.76rem;cursor:pointer;">Ativar</button>
        <button id="push-banner-depois" style="background:transparent;color:#999;border:none;padding:4px;font-size:0.7rem;cursor:pointer;">Depois</button>
      </div>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => { banner.style.transform = 'translateX(-50%) translateY(0)'; });

    document.getElementById('push-banner-ativar').onclick = async () => {
      banner.style.transform = 'translateX(-50%) translateY(120%)';
      setTimeout(() => banner.remove(), 500);
      const token = await pedirPermissao(pedidoToken);
      if (token) mostrarToastPush('🔔 Notificações ativadas!', 'Você receberá atualizações em tempo real.', '/');
    };
    document.getElementById('push-banner-depois').onclick = () => {
      banner.style.transform = 'translateX(-50%) translateY(120%)';
      setTimeout(() => banner.remove(), 500);
      localStorage.setItem(STORAGE_PERMISSAO, '1');
    };
  }

  function mostrarToastPush(titulo, body, link) {
    const t = document.createElement('div');
    t.style.cssText = `
      position: fixed; top: 16px; left: 50%;
      transform: translateX(-50%) translateY(-100%);
      background: white; border: 1px solid #ffe0cc;
      box-shadow: 0 12px 40px rgba(255,102,0,0.3);
      border-radius: 18px; padding: 14px 18px;
      display: flex; align-items: center; gap: 12px;
      max-width: 92vw; width: 360px; z-index: 99999;
      font-family: var(--fonte, sans-serif); cursor: pointer;
      transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      border-left: 5px solid #ff6600;
    `;
    t.innerHTML = `
      <div style="font-size:1.8rem;">🔔</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;color:#cc5200;font-size:0.9rem;">${titulo}</div>
        <div style="font-size:0.78rem;color:#666;line-height:1.3;">${body}</div>
      </div>
    `;
    t.onclick = () => { if (link) window.location.href = link; t.remove(); };
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => {
      t.style.transform = 'translateX(-50%) translateY(-100%)';
      setTimeout(() => t.remove(), 500);
    }, 6000);
  }

  window.PushNotifications = {
    inicializar,
    pedirPermissao,
    registrarTokenAtual,
    mostrarBannerPermissao,
    configurado,
    permissao: () => 'Notification' in window ? Notification.permission : 'unsupported'
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (configurado() && 'Notification' in window && Notification.permission === 'granted') {
      await inicializar();
      registrarTokenAtual();
    }
  });
})();
