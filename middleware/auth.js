const AuthService = require('../services/authService');

// Hierarquia de níveis (índice = poder)
const NIVEL_PODER = {
  'requisitor': 1,
  'supervisor': 2,
  'controldesk': 3,
  'admin': 4
};

// Acesso de cada nível às telas
const ACESSO_TELAS = {
  requisitor: ['solicitante'],
  supervisor: ['solicitante', 'historico'],
  controldesk: ['solicitante', 'analista', 'gestao'],
  admin: ['solicitante', 'analista', 'gestao', 'historico', 'dev']
};

/**
 * Middleware de autenticação
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = AuthService.verificarToken(token);
    req.usuario = decoded;
    req.nivel = decoded.nivel;
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
}

/**
 * Middleware de autorização por nível mínimo
 * @param {string} nivelMinimo - 'requisitor', 'supervisor', 'controldesk', 'admin'
 */
function autorizar(nivelMinimo) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const poderUsuario = NIVEL_PODER[req.nivel] || 0;
    const poderMinimo = NIVEL_PODER[nivelMinimo] || 99;

    if (poderUsuario < poderMinimo) {
      return res.status(403).json({
        error: `Acesso negado. Nível '${req.nivel}' não tem permissão.`
      });
    }

    next();
  };
}

/**
 * Retorna as telas que o nível pode acessar
 */
function telasDoNivel(nivel) {
  return ACESSO_TELAS[nivel] || [];
}

module.exports = { autenticar, autorizar, telasDoNivel };
