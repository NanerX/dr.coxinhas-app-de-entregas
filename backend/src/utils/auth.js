const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dr-coxinha-dev-secret-troque-em-producao';

function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  const token = header.split(' ')[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { JWT_SECRET, adminAuth };
