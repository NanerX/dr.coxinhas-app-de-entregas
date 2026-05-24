const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { adminAuth } = require('../utils/auth');

const router = express.Router();

const CATEGORIAS_VALIDAS = [
  'salgados-no-copo',
  'salgados-fritos',
  'salgados-assados',
  'lanches',
  'bebidas',
  'sobremesas',
  'combos'
];

// Público — produtos disponíveis (ativos e com estoque)
router.get('/produtos', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { categoria } = req.query;
  let produtos = db.read('produtos.json') || [];
  produtos = produtos.filter(p => p.ativo && p.estoque > 0);
  if (categoria) produtos = produtos.filter(p => p.categoria === categoria);
  res.json(produtos);
});

// Admin — todos os produtos (incluindo sem estoque)
router.get('/admin/produtos', adminAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { categoria } = req.query;
  let produtos = db.read('produtos.json') || [];
  if (categoria) produtos = produtos.filter(p => p.categoria === categoria);

  const alertas = produtos.filter(p => p.ativo && p.estoque === 0).map(p => p.nome);
  res.json({ produtos, alertas });
});

// Admin — criar produto
router.post('/admin/produtos', adminAuth, (req, res) => {
  const { nome, descricao, preco, categoria, estoque, ativo, imagem } = req.body;

  if (!nome || preco === undefined || !categoria) {
    return res.status(400).json({ erro: 'Nome, preço e categoria são obrigatórios' });
  }
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({ erro: `Categoria inválida. Use: ${CATEGORIAS_VALIDAS.join(', ')}` });
  }

  const produtos = db.read('produtos.json') || [];
  const novo = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    descricao: descricao?.trim() || '',
    preco: parseFloat(preco),
    categoria,
    imagem: imagem || null,
    estoque: parseInt(estoque) ?? 0,
    ativo: ativo !== false,
    criadoEm: new Date().toISOString()
  };

  produtos.push(novo);
  db.write('produtos.json', produtos);
  res.status(201).json(novo);
});

// Admin — atualizar produto
router.put('/admin/produtos/:id', adminAuth, (req, res) => {
  const produtos = db.read('produtos.json') || [];
  const idx = produtos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Produto não encontrado' });

  const { nome, descricao, preco, categoria, estoque, ativo, imagem } = req.body;
  const atual = produtos[idx];

  if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({ erro: `Categoria inválida. Use: ${CATEGORIAS_VALIDAS.join(', ')}` });
  }

  produtos[idx] = {
    ...atual,
    nome: nome !== undefined ? nome.trim() : atual.nome,
    descricao: descricao !== undefined ? descricao.trim() : atual.descricao,
    preco: preco !== undefined ? parseFloat(preco) : atual.preco,
    categoria: categoria || atual.categoria,
    estoque: estoque !== undefined ? parseInt(estoque) : atual.estoque,
    ativo: ativo !== undefined ? Boolean(ativo) : atual.ativo,
    imagem: imagem !== undefined ? imagem : atual.imagem,
    atualizadoEm: new Date().toISOString()
  };

  db.write('produtos.json', produtos);
  res.json(produtos[idx]);
});

// Admin — deletar produto
router.delete('/admin/produtos/:id', adminAuth, (req, res) => {
  const produtos = db.read('produtos.json') || [];
  const filtered = produtos.filter(p => p.id !== req.params.id);
  if (filtered.length === produtos.length) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }
  db.write('produtos.json', filtered);
  res.json({ ok: true });
});

// Admin — upload de imagem (base64 comprimida pelo browser)
router.post('/admin/produtos/:id/imagem', adminAuth, (req, res) => {
  const { imagem } = req.body;
  if (!imagem) return res.status(400).json({ erro: 'Campo imagem obrigatório' });

  const match = imagem.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);
  if (!match) return res.status(400).json({ erro: 'Formato inválido. Use data URL base64.' });

  const produtos = db.read('produtos.json') || [];
  const idx = produtos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Produto não encontrado' });

  produtos[idx].imagem = imagem;
  produtos[idx].atualizadoEm = new Date().toISOString();
  db.write('produtos.json', produtos);

  res.json({ ok: true });
});

// Admin — ajustar estoque
router.patch('/admin/produtos/:id/estoque', adminAuth, (req, res) => {
  const { estoque } = req.body;
  if (estoque === undefined || isNaN(estoque) || parseInt(estoque) < 0) {
    return res.status(400).json({ erro: 'Estoque inválido' });
  }

  const produtos = db.read('produtos.json') || [];
  const idx = produtos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: 'Produto não encontrado' });

  produtos[idx].estoque = parseInt(estoque);
  produtos[idx].atualizadoEm = new Date().toISOString();
  db.write('produtos.json', produtos);
  res.json({ estoque: produtos[idx].estoque });
});

module.exports = router;
