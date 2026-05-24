const express = require('express');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');

const router = express.Router();

function filtrarPorData(lista, campo, dataStr) {
  return lista.filter(item => (item[campo] || '').startsWith(dataStr));
}

function calcularMaisVendidos(itens) {
  const contagem = {};
  for (const item of itens) {
    const key = item.nome;
    if (!contagem[key]) contagem[key] = { nome: key, quantidade: 0, total: 0 };
    contagem[key].quantidade += item.quantidade;
    contagem[key].total += item.subtotal;
  }
  return Object.values(contagem).sort((a, b) => b.quantidade - a.quantidade).slice(0, 10);
}

function calcularPorHora(pedidos, campo) {
  const horas = {};
  for (const p of pedidos) {
    const h = new Date(p[campo]).getHours();
    if (!horas[h]) horas[h] = { hora: h, pedidos: 0, total: 0 };
    horas[h].pedidos++;
    horas[h].total += p.total;
  }
  return Object.values(horas).sort((a, b) => a.hora - b.hora);
}

router.get('/admin/relatorios/diario', adminAuth, (req, res) => {
  const { data } = req.query;
  const dia = data || new Date().toISOString().slice(0, 10);

  const pedidos = filtrarPorData(db.read('pedidos.json') || [], 'criadoEm', dia);
  const vendas = filtrarPorData(db.read('vendas.json') || [], 'criadoEm', dia);

  const pedidosEntregues = pedidos.filter(p => p.status === 'entregue');
  const pedidosCancelados = pedidos.filter(p => p.status === 'cancelado');

  const faturamentoPedidos = pedidosEntregues.reduce((s, p) => s + p.total, 0);
  const faturamentoPDV = vendas.reduce((s, v) => s + v.total, 0);
  const faturamentoTotal = parseFloat((faturamentoPedidos + faturamentoPDV).toFixed(2));

  const totalTransacoes = pedidosEntregues.length + vendas.length;
  const ticketMedio = totalTransacoes > 0
    ? parseFloat((faturamentoTotal / totalTransacoes).toFixed(2))
    : 0;

  const todosItens = [
    ...pedidosEntregues.flatMap(p => p.itens),
    ...vendas.flatMap(v => v.itens)
  ];

  const porFormaPagamento = {};
  for (const p of [...pedidosEntregues, ...vendas]) {
    const metodo = p.pagamento?.metodo || 'desconhecido';
    if (!porFormaPagamento[metodo]) porFormaPagamento[metodo] = { count: 0, total: 0 };
    porFormaPagamento[metodo].count++;
    porFormaPagamento[metodo].total = parseFloat((porFormaPagamento[metodo].total + p.total).toFixed(2));
  }

  res.json({
    data: dia,
    resumo: {
      faturamentoTotal,
      faturamentoPedidos: parseFloat(faturamentoPedidos.toFixed(2)),
      faturamentoPDV: parseFloat(faturamentoPDV.toFixed(2)),
      totalPedidos: pedidos.length,
      pedidosEntregues: pedidosEntregues.length,
      pedidosCancelados: pedidosCancelados.length,
      vendasPDV: vendas.length,
      ticketMedio
    },
    maisVendidos: calcularMaisVendidos(todosItens),
    porHora: calcularPorHora([...pedidosEntregues, ...vendas], 'criadoEm'),
    porFormaPagamento
  });
});

router.get('/admin/relatorios/periodo', adminAuth, (req, res) => {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) {
    return res.status(400).json({ erro: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
  }

  const dtInicio = new Date(inicio + 'T00:00:00');
  const dtFim = new Date(fim + 'T23:59:59');

  const pedidos = (db.read('pedidos.json') || []).filter(p => {
    const dt = new Date(p.criadoEm);
    return dt >= dtInicio && dt <= dtFim && p.status === 'entregue';
  });

  const vendas = (db.read('vendas.json') || []).filter(v => {
    const dt = new Date(v.criadoEm);
    return dt >= dtInicio && dt <= dtFim;
  });

  const faturamento = parseFloat(
    ([...pedidos, ...vendas].reduce((s, p) => s + p.total, 0)).toFixed(2)
  );

  const todosItens = [
    ...pedidos.flatMap(p => p.itens),
    ...vendas.flatMap(v => v.itens)
  ];

  res.json({
    periodo: { inicio, fim },
    faturamento,
    totalTransacoes: pedidos.length + vendas.length,
    maisVendidos: calcularMaisVendidos(todosItens)
  });
});

module.exports = router;
