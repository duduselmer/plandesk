const express = require('express');
const router = express.Router();
const UsuarioService = require('../services/usuarioService');
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);

// ══════════════════════════════════════
// Rotas PÚBLICAS (qualquer logado)
// ══════════════════════════════════════

// Listar usuários
router.get('/', async (req, res) => {
  try { const usuarios = await UsuarioService.listarUsuarios(); res.json(usuarios); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Buscar usuário por ID
router.get('/:id', async (req, res) => {
  try { const u = await UsuarioService.buscarPorId(req.params.id); if (!u) return res.status(404).json({ error: 'Usuário não encontrado' }); res.json(u); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listar setores de origem
router.get('/setores/origem', async (req, res) => {
  try { const setores = await UsuarioService.listarSetoresOrigem(); res.json(setores); } catch(e) { res.status(500).json({ error: e.message }); }
});

// Listar setores de destino
router.get('/setores/destino', async (req, res) => {
  try { const setores = await UsuarioService.listarSetoresDestino(); res.json(setores); } catch(e) { res.status(500).json({ error: e.message }); }
});

// Listar setores de origem de um usuário
router.get('/:id/setores-origem', async (req, res) => {
  try { const setores = await UsuarioService.listarSetoresOrigemDoUsuario(req.params.id); res.json(setores); } catch(e) { res.status(500).json({ error: e.message }); }
});

// Listar setores de destino de um usuário
router.get('/:id/setores-destino', async (req, res) => {
  try { const setores = await UsuarioService.listarSetoresDestinoDoUsuario(req.params.id); res.json(setores); } catch(e) { res.status(500).json({ error: e.message }); }
});

// Listar níveis
router.get('/niveis/lista', async (req, res) => {
  try { res.json(UsuarioService.listarNiveis()); } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════
// Rotas RESTRITAS (supervisor+)
// ══════════════════════════════════════
router.use(autorizar('supervisor'));

// Criar usuário
router.post('/', async (req, res) => {
  try { const { nome, email, senha, nivel } = req.body; if (!nome || !email || !senha || !nivel) return res.status(400).json({ error: 'Todos os campos obrigatórios' }); const result = await UsuarioService.criarUsuario(nome, email, senha, nivel); res.status(201).json(result); } catch (e) { res.status(400).json({ error: e.message }); }
});

// Atualizar usuário
router.put('/:id', async (req, res) => {
  try { const result = await UsuarioService.atualizarUsuario(req.params.id, req.body); res.json(result); } catch (e) { res.status(400).json({ error: e.message }); }
});

// Criar setor de origem
router.post('/setores/origem', async (req, res) => {
  try { const r = await UsuarioService.criarSetorOrigem(req.body.nome); res.status(201).json(r); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Remover setor de origem
router.delete('/setores/origem/:id', async (req, res) => {
  try { await UsuarioService.removerSetorOrigem(req.params.id); res.json({ ok: true }); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Criar setor de destino
router.post('/setores/destino', async (req, res) => {
  try { const r = await UsuarioService.criarSetorDestino(req.body.nome); res.status(201).json(r); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Remover setor de destino
router.delete('/setores/destino/:id', async (req, res) => {
  try { await UsuarioService.removerSetorDestino(req.params.id); res.json({ ok: true }); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Vincular setor de origem a usuário
router.post('/:id/setores-origem', async (req, res) => {
  try { await UsuarioService.vincularSetorOrigem(req.params.id, req.body.setor_id); res.json({ ok: true }); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Desvincular setor de origem
router.delete('/:id/setores-origem/:setorId', async (req, res) => {
  try { await UsuarioService.desvincularSetorOrigem(req.params.id, req.params.setorId); res.json({ ok: true }); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Vincular setor de destino a usuário
router.post('/:id/setores-destino', async (req, res) => {
  try { await UsuarioService.vincularSetorDestino(req.params.id, req.body.setor_id); res.json({ ok: true }); } catch(e) { res.status(400).json({ error: e.message }); }
});

// Desvincular setor de destino
router.delete('/:id/setores-destino/:setorId', async (req, res) => {
  try { await UsuarioService.desvincularSetorDestino(req.params.id, req.params.setorId); res.json({ ok: true }); } catch(e) { res.status(400).json({ error: e.message }); }
});

// ══════════════════════════════════════
// Rotas ADMIN (níveis)
// ══════════════════════════════════════

// Salvar configuração de nível
router.put('/niveis/:nome', autorizar('admin'), async (req, res) => {
  try {
    const { telas } = req.body;
    const { nome } = req.params;
    const niveisValidos = ['requisitor', 'supervisor', 'controldesk', 'gerente', 'admin'];
    if (!niveisValidos.includes(nome)) return res.status(400).json({ error: 'Nível inválido' });
    res.json({ message: `Nível "${nome}" atualizado`, telas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
