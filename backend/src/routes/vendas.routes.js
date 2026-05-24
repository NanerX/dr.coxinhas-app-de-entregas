const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');

const router = express.Router();

// PDV — registrar venda no balcão
router.post('/admin/vendas', adminAuth, (req, res) => {
  const { itens, pagamento, observacao } = req.body;

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Venda deve ter pelo menos um item' });
  }
  if (!pagamento?.metodo) {
    return res.status(400).json({ erro: 'Forma de pagamento é obrigatória' });
  }

  // Valida e desconta estoque
  const produtos = db.read('produtos.json') || [];
  const itensValidados = [];
  const erros = [];

  for (const item of itens) {
    if (!item.produtoId || !item.quantidade || item.quantidade < 1) {
      erros.push('Item inválido');
      continue;
    }
    const prod = produtos.find(p => p.id === item.produtoId);
    if (!prod || !prod.ativo) {
      erros.push(`Produto "${item.nome || item.produtoId}" não encontrado`);
      continue;
    }
    if (prod.estoque < item.quantidade) {
      erros.push(`Estoque insuficiente para "${prod.nome}" (disponível: ${prod.estoque})`);
      continue;
    }
    itensValidados.push({
      produtoId: prod.id,
      nome: prod.nome,
      preco: prod.preco,
      quantidade: parseInt(item.quantidade),
      subtotal: parseFloat((prod.preco * item.quantidade).toFixed(2))
    });
  }

  if (erros.length > 0) {
    return res.status(422).json({ erro: erros.join('; ') });
  }

  for (const item of itensValidados) {
    const idx = produtos.findIndex(p => p.id === item.produtoId);
    produtos[idx].estoque -= item.quantidade;
  }
  db.write('produtos.json', produtos);

  const total = parseFloat(itensValidados.reduce((s, i) => s + i.subtotal, 0).toFixed(2));

  const venda = {
    id: crypto.randomUUID(),
    itens: itensValidados,
    total,
    pagamento: {
      metodo: pagamento.metodo,
      troco: pagamento.troco ? parseFloat(pagamento.troco) : null
    },
    observacao: observacao?.trim() || '',
    vendidoPor: req.admin.nome,
    criadoEm: new Date().toISOString()
  };

  const vendas = db.read('vendas.json') || [];
  vendas.unshift(venda);
  db.write('vendas.json', vendas);

  // Registra no caixa
  const caixa = db.read('caixa.json') || { saldo: 0, movimentos: [] };
  caixa.movimentos.push({
    id: crypto.randomUUID(),
    tipo: 'entrada',
    valor: total,
    descricao: `PDV — ${itensValidados.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}`,
    data: new Date().toISOString(),
    vendaId: venda.id
  });
  caixa.saldo = parseFloat((caixa.saldo + total).toFixed(2));
  db.write('caixa.json', caixa);

  res.status(201).json(venda);
});

// Admin — listar vendas PDV
router.get('/admin/vendas', adminAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { data } = req.query;
  let vendas = db.read('vendas.json') || [];
  if (data) vendas = vendas.filter(v => v.criadoEm.startsWith(data));
  res.json(vendas);
});

module.exports = router;
