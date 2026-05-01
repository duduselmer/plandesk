const AuthService = require('../services/authService');

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
    req.perfil = req.headers['x-perfil-sessao'] || decoded.perfil || 'solicitante';
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
}

/**
 * Middleware de autorização por perfil
 * @param  {...string} perfis - Lista de perfis permitidos
 */
function autorizar(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!perfis.includes(req.perfil)) {
      return res.status(403).json({
        error: `Acesso negado. Perfil '${req.perfil}' não autorizado.`
      });
    }

    next();
  };
}

module.exports = { autenticar, autorizar };
