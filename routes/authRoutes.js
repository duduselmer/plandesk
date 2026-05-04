const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const { autenticar, telasDoNivel } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Retorna: { token, nome, email, nivel }
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
      nome: resultado.nome,
      email: resultado.email,
      nivel: resultado.nivel
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
 * Retorna dados do usuário + telas que pode acessar
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
      nivel: user.nivel,
      telas: telasDoNivel(user.nivel),
      ativo: user.ativo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
