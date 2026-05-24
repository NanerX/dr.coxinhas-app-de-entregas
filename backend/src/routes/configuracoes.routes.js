const express = require('express');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');

const router = express.Router();

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function lojaEstaAberta(config) {
  const { status, horarios } = config;

  if (status.modoManual) {
    return status.abertaManualmente;
  }

  const agora = new Date();
  const diaNome = DIAS_SEMANA[agora.getDay()];
  const horarioDia = horarios[diaNome];

  if (!horarioDia || !horarioDia.ativo) return false;

  const [hAb, mAb] = horarioDia.abertura.split(':').map(Number);
  const [hFe, mFe] = horarioDia.fechamento.split(':').map(Number);
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const minAbertura = hAb * 60 + mAb;
  const minFechamento = hFe * 60 + mFe;

  return minAgora >= minAbertura && minAgora < minFechamento;
}

// Público — retorna config + status calculado
router.get('/configuracoes', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const config = db.read('configuracoes.json');
  if (!config) return res.status(500).json({ erro: 'Configurações não encontradas' });

  const aberta = lojaEstaAberta(config);
  res.json({ ...config, aberta });
});

// Admin — atualiza configurações
router.put('/admin/configuracoes', adminAuth, (req, res) => {
  const config = db.read('configuracoes.json') || {};
  const { loja, status, horarios } = req.body;

  const updated = {
    loja: loja ? { ...config.loja, ...loja } : config.loja,
    status: status ? { ...config.status, ...status } : config.status,
    horarios: horarios ? { ...config.horarios, ...horarios } : config.horarios
  };

  db.write('configuracoes.json', updated);
  const aberta = lojaEstaAberta(updated);

  if (req.io) req.io.emit('config:atualizada', { ...updated, aberta });

  res.json({ ...updated, aberta });
});

module.exports = router;
