const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');
const fcm = require('../services/fcm.service');

const router = express.Router();

// Cliente se inscreve para receber notificações
router.post('/notifications/subscribe', (req, res) => {
  const { fcmToken, orderToken } = req.body;
  if (!fcmToken) return res.status(400).json({ erro: 'fcmToken obrigatório' });

  const tokens = db.read('fcm-tokens.json') || [];
  const existing = tokens.find(t => t.fcmToken === fcmToken);

  if (existing) {
    if (orderToken && !existing.orderTokens.includes(orderToken)) {
      existing.orderTokens.push(orderToken);
    }
    existing.ativo = true;
    existing.atualizadoEm = new Date().toISOString();
  } else {
    tokens.push({
      id: crypto.randomUUID(),
      fcmToken,
      orderTokens: orderToken ? [orderToken] : [],
      ativo: true,
      subscribedAt: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
  }

  db.write('fcm-tokens.json', tokens);
  res.json({ ok: true });
});

// Cliente associa token de pedido ao FCM token existente
router.post('/notifications/track-order', (req, res) => {
  const { fcmToken, orderToken } = req.body;
  if (!fcmToken || !orderToken) {
    return res.status(400).json({ erro: 'fcmToken e orderToken obrigatórios' });
  }

  const tokens = db.read('fcm-tokens.json') || [];
  const entry = tokens.find(t => t.fcmToken === fcmToken);
  if (!entry) return res.status(404).json({ erro: 'Token não encontrado, inscreva-se primeiro' });

  if (!entry.orderTokens.includes(orderToken)) {
    entry.orderTokens.push(orderToken);
    db.write('fcm-tokens.json', tokens);
  }
  res.json({ ok: true });
});

// Admin — envia promoção para todos os inscritos
router.post('/admin/notifications/promocao', adminAuth, async (req, res) => {
  const { titulo, mensagem, link } = req.body;
  if (!titulo || !mensagem) {
    return res.status(400).json({ erro: 'Título e mensagem são obrigatórios' });
  }

  const tokens = db.read('fcm-tokens.json') || [];
  const ativos = [...new Set(tokens.filter(t => t.ativo).map(t => t.fcmToken))];

  let resultado = { successCount: 0, failureCount: 0 };
  if (ativos.length > 0) {
    resultado = await fcm.sendToMultiple(ativos, titulo, mensagem, { link: link || '/' });
  }

  const promocoes = db.read('promocoes.json') || [];
  const promo = {
    id: crypto.randomUUID(),
    titulo,
    mensagem,
    link: link || '/',
    totalDestinatarios: ativos.length,
    successCount: resultado.successCount,
    failureCount: resultado.failureCount,
    enviadaEm: new Date().toISOString(),
    enviadaPor: req.admin.nome
  };
  promocoes.unshift(promo);
  db.write('promocoes.json', promocoes);

  res.json({ ok: true, resultado, promo });
});

// Admin — histórico de promoções
router.get('/admin/notifications/historico', adminAuth, (req, res) => {
  const promocoes = db.read('promocoes.json') || [];
  res.json(promocoes);
});

// Admin — quantidade de inscritos
router.get('/admin/notifications/stats', adminAuth, (req, res) => {
  const tokens = db.read('fcm-tokens.json') || [];
  const ativos = new Set(tokens.filter(t => t.ativo).map(t => t.fcmToken));
  res.json({ totalInscritos: ativos.size });
});

module.exports = router;
