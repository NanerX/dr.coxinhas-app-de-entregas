require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const db = require('./utils/db');
const eventBus = require('./utils/event-bus');
const fcm = require('./services/fcm.service');

const authRoutes = require('./routes/auth.routes');
const produtosRoutes = require('./routes/produtos.routes');
const pedidosRoutes = require('./routes/pedidos.routes');
const caixaRoutes = require('./routes/caixa.routes');
const relatoriosRoutes = require('./routes/relatorios.routes');
const vendasRoutes = require('./routes/vendas.routes');
const configuracoesRoutes = require('./routes/configuracoes.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Injeta io nas rotas
app.use((req, _res, next) => { req.io = io; next(); });

// Arquivos estáticos — public/ tem prioridade, frontend/ é fallback para migração
app.use(express.static(path.join(__dirname, '../../frontend/public')));
app.use(express.static(path.join(__dirname, '../../frontend')));

// --- Rotas da API ---
app.use('/api', authRoutes);
app.use('/api', produtosRoutes);
app.use('/api', pedidosRoutes);
app.use('/api', caixaRoutes);
app.use('/api', relatoriosRoutes);
app.use('/api', vendasRoutes);
app.use('/api', configuracoesRoutes);
app.use('/api', notificationsRoutes);

// Fallback SPA — serve index.html para rotas não-API
app.get('*', (req, res) => {
  const fs = require('fs');
  const candidates = [
    path.join(__dirname, '../../frontend/public/index.html'),
    path.join(__dirname, '../../frontend/index.html')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return res.sendFile(candidate);
  }
  res.status(404).send('Dr. Coxinha — em breve!');
});

// --- Socket.IO ---
io.on('connection', (socket) => {
  socket.on('join:admin', () => socket.join('admin'));
  socket.on('join:pedido', (token) => {
    if (token && typeof token === 'string') socket.join(`order:${token}`);
  });
});

// Propaga eventos do eventBus para os clientes Socket.IO
eventBus.on('novo:pedido', (pedido) => {
  io.to('admin').emit('novo:pedido', pedido);
});

eventBus.on('pedido:status', ({ pedido }) => {
  io.to(`order:${pedido.token}`).emit('pedido:atualizado', pedido);
  io.to('admin').emit('pedido:atualizado', pedido);
});

// --- Inicialização ---

async function initAdminUser() {
  const usuarios = db.read('usuarios.json') || [];
  if (usuarios.length === 0) {
    const senha = process.env.ADMIN_PASSWORD || 'admin123';
    const senhaHash = await bcrypt.hash(senha, 10);
    db.write('usuarios.json', [{
      id: '1',
      usuario: 'admin',
      senha: senhaHash,
      nome: 'Administrador',
      criadoEm: new Date().toISOString()
    }]);
    console.log(`[Setup] Admin criado — usuario: admin / senha: ${senha}`);
    console.log('[Setup] ⚠️  Altere a senha padrão em Configurações após o primeiro login!');
  }
}

function initConfig() {
  if (!db.read('configuracoes.json')) {
    db.write('configuracoes.json', {
      loja: {
        nome: 'Dr. Coxinha',
        telefone: '',
        endereco: '',
        taxaEntrega: 5.00,
        taxaEntregaGratis: 0,
        tempoEstimadoEntrega: '30-45 min',
        tempoEstimadoRetirada: '15-20 min',
        pixKey: '',
        mensagemDestaque: 'Os salgadinhos mais gostosos da cidade! 🥟'
      },
      status: { modoManual: false, abertaManualmente: false },
      horarios: {
        domingo: { ativo: false, abertura: '08:00', fechamento: '20:00' },
        segunda: { ativo: true,  abertura: '08:00', fechamento: '22:00' },
        terca:   { ativo: true,  abertura: '08:00', fechamento: '22:00' },
        quarta:  { ativo: true,  abertura: '08:00', fechamento: '22:00' },
        quinta:  { ativo: true,  abertura: '08:00', fechamento: '22:00' },
        sexta:   { ativo: true,  abertura: '08:00', fechamento: '22:00' },
        sabado:  { ativo: true,  abertura: '08:00', fechamento: '22:00' }
      }
    });
    console.log('[Setup] Configurações padrão criadas');
  }
}

function initDatabases() {
  const defaults = {
    'produtos.json':   [],
    'pedidos.json':    [],
    'caixa.json':      { saldo: 0, movimentos: [] },
    'vendas.json':     [],
    'fcm-tokens.json': [],
    'promocoes.json':  []
  };
  for (const [file, value] of Object.entries(defaults)) {
    if (!db.read(file)) {
      db.write(file, value);
      console.log(`[Setup] ${file} criado`);
    }
  }
}

function initFCM() {
  const envJson = process.env.FIREBASE_ADMIN_SDK_JSON;
  if (envJson) {
    try {
      fcm.init(JSON.parse(envJson));
    } catch {
      console.warn('[FCM] FIREBASE_ADMIN_SDK_JSON inválido — push notifications desativadas');
    }
  } else {
    console.info('[FCM] FIREBASE_ADMIN_SDK_JSON não configurado — push notifications desativadas');
  }
}

async function start() {
  initDatabases();
  initConfig();
  await initAdminUser();
  initFCM();

  server.listen(PORT, () => {
    console.log(`\n🥟 Dr. Coxinha rodando em http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
