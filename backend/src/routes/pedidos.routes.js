const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');
const eventBus = require('../utils/event-bus');
const fcm = require('../services/fcm.service');

const router = express.Router();

const STATUS_VALIDOS = ['pendente', 'aceito', 'preparando', 'saindo', 'entregue', 'cancelado'];

const STATUS_MENSAGENS = {
  pendente:    'Pedido recebido! Aguardando confirmação.',
  aceito:      '✅ Pedido aceito! Vamos preparar seu pedido.',
  preparando:  '👨‍🍳 Tirando do óleo na hora!',
  saindo:      '🛵 Pedido saindo para entrega!',
  entregue:    '🎉 Pedido entregue! Obrigado pela preferência!',
  cancelado:   '❌ Pedido cancelado. Entre em contato se precisar de ajuda.'
};

const STATUS_PUSH_TITULO = {
  aceito:     '✅ Pedido aceito!',
  preparando: '👨‍🍳 Preparando seu pedido',
  saindo:     '🛵 Saiu para entrega!',
  entregue:   '🎉 Pedido entregue!',
  cancelado:  '❌ Pedido cancelado'
};

function tokensIguais(a, b) {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function gerarToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function calcularTotal(itens, taxaEntrega, tipoEntrega) {
  const subtotal = itens.reduce((sum, i) => sum + i.preco * i.quantidade, 0);
  const taxa = tipoEntrega === 'retirada' ? 0 : taxaEntrega;
  return { subtotal: parseFloat(subtotal.toFixed(2)), taxa, total: parseFloat((subtotal + taxa).toFixed(2)) };
}

// Público — criar pedido
router.post('/pedidos', (req, res) => {
  const { cliente, itens, tipoEntrega, pagamento, observacao } = req.body;

  if (!cliente?.nome || !cliente?.telefone) {
    return res.status(400).json({ erro: 'Nome e telefone do cliente são obrigatórios' });
  }
  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Pedido deve ter pelo menos um item' });
  }
  if (!['entrega', 'retirada'].includes(tipoEntrega)) {
    return res.status(400).json({ erro: 'Tipo de entrega inválido' });
  }
  if (!pagamento?.metodo) {
    return res.status(400).json({ erro: 'Forma de pagamento é obrigatória' });
  }

  // Verifica se loja está aberta
  const config = db.read('configuracoes.json') || {};
  const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  if (config.status?.modoManual) {
    if (!config.status.abertaManualmente) {
      return res.status(422).json({ erro: 'Loja fechada. Não é possível fazer pedidos no momento.' });
    }
  } else {
    const dia = DIAS[new Date().getDay()];
    const h = config.horarios?.[dia];
    if (!h?.ativo) {
      return res.status(422).json({ erro: 'Loja fechada hoje. Tente novamente amanhã.' });
    }
    const [hAb, mAb] = h.abertura.split(':').map(Number);
    const [hFe, mFe] = h.fechamento.split(':').map(Number);
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes();
    if (min < hAb * 60 + mAb || min >= hFe * 60 + mFe) {
      return res.status(422).json({ erro: `Loja fechada. Abrimos às ${h.abertura}.` });
    }
  }

  // Valida e desconta estoque
  const produtos = db.read('produtos.json') || [];
  const itensValidados = [];
  const errosEstoque = [];

  for (const item of itens) {
    if (!item.produtoId || !item.quantidade || item.quantidade < 1) {
      return res.status(400).json({ erro: 'Item inválido no carrinho' });
    }
    const prod = produtos.find(p => p.id === item.produtoId);
    if (!prod || !prod.ativo) {
      errosEstoque.push(`Produto "${item.nome || item.produtoId}" não disponível`);
      continue;
    }
    if (prod.estoque < item.quantidade) {
      errosEstoque.push(`Estoque insuficiente para "${prod.nome}" (disponível: ${prod.estoque})`);
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

  if (errosEstoque.length > 0) {
    return res.status(422).json({ erro: errosEstoque.join('; ') });
  }

  // Desconta estoque
  for (const item of itensValidados) {
    const idx = produtos.findIndex(p => p.id === item.produtoId);
    produtos[idx].estoque -= item.quantidade;
  }
  db.write('produtos.json', produtos);

  // Calcula totais
  const { subtotal, taxa, total } = calcularTotal(itensValidados, config.loja?.taxaEntrega || 0, tipoEntrega);

  // Cria pedido
  const pedido = {
    id: crypto.randomUUID(),
    token: gerarToken(),
    cliente: {
      nome: cliente.nome.trim(),
      telefone: cliente.telefone,
      endereco: cliente.endereco || '',
      cep: cliente.cep || '',
      bairro: cliente.bairro || '',
      cidade: cliente.cidade || '',
      complemento: cliente.complemento || ''
    },
    itens: itensValidados,
    subtotal,
    taxaEntrega: taxa,
    total,
    tipoEntrega,
    pagamento: {
      metodo: pagamento.metodo,
      troco: pagamento.troco ? parseFloat(pagamento.troco) : null
    },
    observacao: observacao?.trim() || '',
    status: 'pendente',
    historico: [{
      status: 'pendente',
      mensagem: STATUS_MENSAGENS.pendente,
      data: new Date().toISOString()
    }],
    origem: 'app',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  const pedidos = db.read('pedidos.json') || [];
  pedidos.unshift(pedido);
  db.write('pedidos.json', pedidos);

  // Notifica admin em tempo real
  eventBus.emit('novo:pedido', pedido);

  // Responde sem o telefone (campo sensível) e com o token
  const { cliente: cl, ...pedidoPublico } = pedido;
  res.status(201).json({
    ...pedidoPublico,
    cliente: { nome: cl.nome, tipoEntrega: pedido.tipoEntrega }
  });
});

// Público — acompanhar pedido pelo token
router.get('/pedidos/:token', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const pedidos = db.read('pedidos.json') || [];
  const pedido = pedidos.find(p => tokensIguais(p.token, req.params.token));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

  // Inclui dados da loja para exibição no acompanhamento
  const config = db.read('configuracoes.json') || {};
  const loja = config.loja || {};

  // Retorna tudo exceto telefone do cliente (dado sensível)
  const { cliente, ...rest } = pedido;
  const { telefone, ...clientePublico } = cliente;
  res.json({
    ...rest,
    cliente: clientePublico,
    tempoEstimadoEntrega: loja.tempoEstimadoEntrega || '30–45 min',
    tempoEstimadoRetirada: loja.tempoEstimadoRetirada || '15–20 min',
    enderecoLoja: loja.endereco || '',
    telefoneLoja: loja.telefone || ''
  });
});

// Admin — listar pedidos
router.get('/admin/pedidos', adminAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { status, data, limite } = req.query;
  let pedidos = db.read('pedidos.json') || [];

  if (status) pedidos = pedidos.filter(p => p.status === status);

  if (data) {
    const dia = data; // formato YYYY-MM-DD
    pedidos = pedidos.filter(p => p.criadoEm.startsWith(dia));
  }

  const total = pedidos.length;
  if (limite) pedidos = pedidos.slice(0, parseInt(limite));

  res.json({ pedidos, total });
});

// Admin — buscar pedido por ID (com dados completos do cliente)
router.get('/admin/pedidos/:id', adminAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const pedidos = db.read('pedidos.json') || [];
  const pedido = pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(pedido);
});

// Admin — atualizar status do pedido
router.put('/admin/pedidos/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body;
  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}` });
  }

  const pedidos = db.read('pedidos.json') || [];
  const idx = pedidos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Pedido não encontrado' });

  const pedido = pedidos[idx];
  pedido.status = status;
  pedido.atualizadoEm = new Date().toISOString();
  pedido.historico.push({
    status,
    mensagem: STATUS_MENSAGENS[status],
    data: new Date().toISOString()
  });

  // Quando entregue, registra no caixa
  if (status === 'entregue') {
    const caixa = db.read('caixa.json') || { saldo: 0, movimentos: [] };
    caixa.movimentos.push({
      id: crypto.randomUUID(),
      tipo: 'entrada',
      valor: pedido.total,
      descricao: `Pedido #${pedido.id.slice(0, 8)} — ${pedido.cliente.nome}`,
      data: new Date().toISOString(),
      pedidoId: pedido.id
    });
    caixa.saldo = parseFloat((caixa.saldo + pedido.total).toFixed(2));
    db.write('caixa.json', caixa);
  }

  // Quando cancelado, devolve estoque
  if (status === 'cancelado' && pedido.status !== 'cancelado') {
    const produtos = db.read('produtos.json') || [];
    for (const item of pedido.itens) {
      const pidx = produtos.findIndex(p => p.id === item.produtoId);
      if (pidx !== -1) produtos[pidx].estoque += item.quantidade;
    }
    db.write('produtos.json', produtos);
  }

  db.write('pedidos.json', pedidos);

  // Notifica em tempo real
  eventBus.emit('pedido:status', { pedido, status });

  // Push notification para o cliente
  if (STATUS_PUSH_TITULO[status]) {
    const tokens = db.read('fcm-tokens.json') || [];
    const fcmTokens = tokens
      .filter(t => t.ativo && t.orderTokens?.includes(pedido.token))
      .map(t => t.fcmToken);

    if (fcmTokens.length > 0) {
      const titulo = STATUS_PUSH_TITULO[status];
      const mensagem = STATUS_MENSAGENS[status];
      await fcm.sendToMultiple(fcmTokens, titulo, mensagem, {
        link: `/pedido.html?token=${pedido.token}`
      });
    }
  }

  res.json(pedido);
});

// Admin — cancelar e remover pedido do histórico
router.delete('/admin/pedidos/:id', adminAuth, (req, res) => {
  const pedidos = db.read('pedidos.json') || [];
  const filtered = pedidos.filter(p => p.id !== req.params.id);
  if (filtered.length === pedidos.length) {
    return res.status(404).json({ erro: 'Pedido não encontrado' });
  }
  db.write('pedidos.json', filtered);
  res.json({ ok: true });
});

module.exports = router;
