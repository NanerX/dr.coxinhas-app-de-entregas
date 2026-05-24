const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const { JWT_SECRET, adminAuth } = require('../utils/auth');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
  }

  const usuarios = db.read('usuarios.json') || [];
  const user = usuarios.find(u => u.usuario === usuario);
  if (!user) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const senhaValida = await bcrypt.compare(senha, user.senha);
  if (!senhaValida) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, nome: user.nome },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, nome: user.nome });
});

router.get('/auth/verify', adminAuth, (req, res) => {
  res.json({ valido: true, usuario: req.admin });
});

router.put('/admin/auth/senha', adminAuth, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias' });
  }
  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: 'Nova senha deve ter no mínimo 6 caracteres' });
  }

  const usuarios = db.read('usuarios.json') || [];
  const idx = usuarios.findIndex(u => u.id === req.admin.id);
  if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado' });

  const senhaValida = await bcrypt.compare(senhaAtual, usuarios[idx].senha);
  if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta' });

  usuarios[idx].senha = await bcrypt.hash(novaSenha, 10);
  db.write('usuarios.json', usuarios);
  res.json({ ok: true });
});

module.exports = router;
