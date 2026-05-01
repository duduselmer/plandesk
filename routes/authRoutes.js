const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const { autenticar } = require('../middleware/auth');
const db = require('../db/connection');

/**
 * POST /api/auth/login
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
      perfis: resultado.perfis
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
 * Retorna dados do usuário + perfis disponíveis
 */
router.get('/me', autenticar, async (req, res) => {
  try {
    const user = await AuthService.buscarPorId(req.usuario.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar perfis
    db.all(
      'SELECT perfil FROM usuario_perfis WHERE usuario_id = ?',
      [req.usuario.id],
      (err, rows) => {
        const perfis = rows ? rows.map(r => r.perfil) : [user.perfil];
        
        res.json({
          id: user.id,
          nome: user.nome,
          email: user.email,
          perfis: perfis,
          ativo: user.ativo
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
