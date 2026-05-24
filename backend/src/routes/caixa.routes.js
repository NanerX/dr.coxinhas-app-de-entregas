const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');

const router = express.Router();

router.get('/admin/caixa', adminAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const caixa = db.read('caixa.json') || { saldo: 0, movimentos: [] };
  res.json(caixa);
});

router.post('/admin/caixa/entrada', adminAuth, (req, res) => {
  const { valor, descricao } = req.body;
  if (!valor || isNaN(valor) || parseFloat(valor) <= 0) {
    return res.status(400).json({ erro: 'Valor inválido' });
  }

  const caixa = db.read('caixa.json') || { saldo: 0, movimentos: [] };
  const movimento = {
    id: crypto.randomUUID(),
    tipo: 'entrada',
    valor: parseFloat(valor),
    descricao: descricao || 'Entrada manual',
    data: new Date().toISOString()
  };

  caixa.movimentos.push(movimento);
  caixa.saldo = parseFloat((caixa.saldo + movimento.valor).toFixed(2));
  db.write('caixa.json', caixa);
  res.status(201).json({ movimento, saldo: caixa.saldo });
});

router.post('/admin/caixa/saida', adminAuth, (req, res) => {
  const { valor, descricao } = req.body;
  if (!valor || isNaN(valor) || parseFloat(valor) <= 0) {
    return res.status(400).json({ erro: 'Valor inválido' });
  }

  const caixa = db.read('caixa.json') || { saldo: 0, movimentos: [] };
  const movimento = {
    id: crypto.randomUUID(),
    tipo: 'saida',
    valor: parseFloat(valor),
    descricao: descricao || 'Saída manual',
    data: new Date().toISOString()
  };

  caixa.movimentos.push(movimento);
  caixa.saldo = parseFloat((caixa.saldo - movimento.valor).toFixed(2));
  db.write('caixa.json', caixa);
  res.status(201).json({ movimento, saldo: caixa.saldo });
});

router.delete('/admin/caixa/movimentos/:id', adminAuth, (req, res) => {
  const caixa = db.read('caixa.json') || { saldo: 0, movimentos: [] };
  const mov = caixa.movimentos.find(m => m.id === req.params.id);
  if (!mov) return res.status(404).json({ erro: 'Movimento não encontrado' });

  caixa.movimentos = caixa.movimentos.filter(m => m.id !== req.params.id);
  const ajuste = mov.tipo === 'entrada' ? -mov.valor : mov.valor;
  caixa.saldo = parseFloat((caixa.saldo + ajuste).toFixed(2));
  db.write('caixa.json', caixa);
  res.json({ ok: true, saldo: caixa.saldo });
});

module.exports = router;
