const express = require('express');
const router = express.Router();
const ReaberturaService = require('../services/reaberturaService');

const identificarPerfil = (req, res, next) => {
  req.perfil = (req.headers['x-perfil'] || 'solicitante').toLowerCase();
  req.usuario = req.headers['x-usuario'] || 'anônimo';
  next();
};

router.use(identificarPerfil);

// Verificar se pode reabrir
router.get('/:id/pode-reabrir', async (req, res) => {
  try {
    const result = await ReaberturaService.podeSolicitarReabertura(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar reaberturas de um ticket
router.get('/:id/reaberturas', async (req, res) => {
  try {
    const reaberturas = await ReaberturaService.listarReaberturas(req.params.id);
    res.json(reaberturas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar pendentes (analista)
router.get('/pendentes/lista', async (req, res) => {
  try {
    if (req.perfil !== 'analista') return res.status(403).json({ error: 'Acesso restrito' });
    const pendentes = await ReaberturaService.listarPendentes();
    res.json(pendentes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Solicitar reabertura
router.post('/:id/reaberturas/solicitar', async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo || !motivo.trim()) return res.status(400).json({ error: 'Motivo obrigatório' });
    const result = await ReaberturaService.solicitarReabertura(req.params.id, motivo);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Cancelar solicitação
router.patch('/reaberturas/:rid/cancelar', async (req, res) => {
  try {
    const result = await ReaberturaService.cancelarSolicitacao(req.params.rid);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Aceitar reabertura (analista)
router.patch('/reaberturas/:rid/aceitar', async (req, res) => {
  try {
    if (req.perfil !== 'analista') return res.status(403).json({ error: 'Apenas analistas' });
    const { prioridade } = req.body;
    if (!prioridade) return res.status(400).json({ error: 'Prioridade obrigatória' });
    const result = await ReaberturaService.aceitarReabertura(req.params.rid, prioridade, req.usuario);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Recusar reabertura (analista)
router.patch('/reaberturas/:rid/recusar', async (req, res) => {
  try {
    if (req.perfil !== 'analista') return res.status(403).json({ error: 'Apenas analistas' });
    const { justificativa } = req.body;
    if (!justificativa || !justificativa.trim()) return res.status(400).json({ error: 'Justificativa obrigatória' });
    const result = await ReaberturaService.recusarReabertura(req.params.rid, justificativa, req.usuario);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Concluir ciclo (analista)
router.patch('/reaberturas/:rid/concluir', async (req, res) => {
  try {
    if (req.perfil !== 'analista') return res.status(403).json({ error: 'Apenas analistas' });
    const { descricao_final, link_referencia, justificativa } = req.body;
    if (!descricao_final || !descricao_final.trim()) return res.status(400).json({ error: 'Descrição obrigatória' });
    const result = await ReaberturaService.concluirReabertura(req.params.rid, descricao_final, link_referencia, justificativa);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
