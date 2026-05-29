onst express = require('express');
const router = express.Router();
const UsuarioService = require('../services/usuarioService');
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);
router.use(autorizar('supervisor'));

// ── Usuários ──
router.get('/', async (req, res) => {
  try { const usuarios = await UsuarioService.listarUsuarios(); res.json(usuarios); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try { const u = await UsuarioService.buscarPorId(req.params.id); if (!u) return res.status(404).json({ error: 'Usuário não encontrado' }); res.json(u); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try { const { nome, email, senha, nivel } = req.body; if (!nome || !email || !senha || !nivel) return res.status(400).json({ error: 'Todos os campos obrigatórios' }); const result = await UsuarioService.criarUsuario(nome, email, senha, nivel); res.status(201).json(result); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try { const result = await UsuarioService.atualizarUsuario(req.params.id, req.body); res.json(result); } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Setores ──
router.get('/setores/origem', async (req, res) => { res.json(await UsuarioService.listarSetoresOrigem()); });
router.post('/setores/origem', async (req, res) => { try { const r = await UsuarioService.criarSetorOrigem(req.body.nome); res.status(201).json(r); } catch(e) { res.status(400).json({error:e.message}); } });
router.delete('/setores/origem/:id', async (req, res) => { try { await UsuarioService.removerSetorOrigem(req.params.id); res.json({ok:true}); } catch(e) { res.status(400).json({error:e.message}); } });
router.get('/setores/destino', async (req, res) => { res.json(await UsuarioService.listarSetoresDestino()); });
router.post('/setores/destino', async (req, res) => { try { const r = await UsuarioService.criarSetorDestino(req.body.nome); res.status(201).json(r); } catch(e) { res.status(400).json({error:e.message}); } });
router.delete('/setores/destino/:id', async (req, res) => { try { await UsuarioService.removerSetorDestino(req.params.id); res.json({ok:true}); } catch(e) { res.status(400).json({error:e.message}); } });

// ── Vínculos ──
router.get('/:id/setores-origem', async (req, res) => { res.json(await UsuarioService.listarSetoresOrigemDoUsuario(req.params.id)); });
router.post('/:id/setores-origem', async (req, res) => { try { await UsuarioService.vincularSetorOrigem(req.params.id, req.body.setor_id); res.json({ok:true}); } catch(e) { res.status(400).json({error:e.message}); } });
router.delete('/:id/setores-origem/:setorId', async (req, res) => { try { await UsuarioService.desvincularSetorOrigem(req.params.id, req.params.setorId); res.json({ok:true}); } catch(e) { res.status(400).json({error:e.message}); } });
router.get('/:id/setores-destino', async (req, res) => { res.json(await UsuarioService.listarSetoresDestinoDoUsuario(req.params.id)); });
router.post('/:id/setores-destino', async (req, res) => { try { await UsuarioService.vincularSetorDestino(req.params.id, req.body.setor_id); res.json({ok:true}); } catch(e) { res.status(400).json({error:e.message}); } });
router.delete('/:id/setores-destino/:setorId', async (req, res) => { try { await UsuarioService.desvincularSetorDestino(req.params.id, req.params.setorId); res.json({ok:true}); } catch(e) { res.status(400).json({error:e.message}); } });

// ── Níveis ──
router.get('/niveis/lista', async (req, res) => { res.json(UsuarioService.listarNiveis()); });

module.exports = router;
