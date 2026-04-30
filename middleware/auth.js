const AuthService = require('../services/authService');

/**
 * Middleware de autenticação
 * Verifica se o token JWT é válido e injeta req.usuario
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
    req.perfil = decoded.perfil;
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }
}

/**
 * Middleware de autorização por perfil
 * @param  {...string} perfis - Lista de perfis permitidos
 * @returns {function} middleware
 */
function autorizar(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({
        error: `Acesso negado. Perfil '${req.usuario.perfil}' não autorizado para esta operação.`
      });
    }

    next();
  };
}

module.exports = { autenticar, autorizar };