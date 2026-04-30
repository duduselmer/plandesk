const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const { autenticar } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Body: { email, senha }
 * Retorna: { token, perfil, nome, email }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const resultado = await AuthService.login(email, senha);
    
    res.json({
      success: true,
      token: resultado.token,
      perfil: resultado.perfil,
      nome: resultado.nome,
      email: resultado.email
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Retorna dados do usuário logado
 */
router.get('/me', autenticar, async (req, res) => {
  try {
    const user = await AuthService.buscarPorId(req.usuario.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      ativo: user.ativo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
