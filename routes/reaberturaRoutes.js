const express = require('express');
const router = express.Router();
const ReaberturaService = require('../services/reaberturaService');
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);

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

// Listar pendentes (controldesk ou admin)
router.get('/pendentes/lista', autorizar('controldesk'), async (req, res) => {
  try {
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
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Motivo obrigatório' });
    }
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

// Aceitar reabertura (controldesk ou admin)
router.patch('/reaberturas/:rid/aceitar', autorizar('controldesk'), async (req, res) => {
  try {
    const { prioridade } = req.body;
    if (!prioridade) {
      return res.status(400).json({ error: 'Prioridade obrigatória' });
    }
    const result = await ReaberturaService.aceitarReabertura(
      req.params.rid, prioridade, req.usuario.nome
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Recusar reabertura (controldesk ou admin)
router.patch('/reaberturas/:rid/recusar', autorizar('controldesk'), async (req, res) => {
  try {
    const { justificativa } = req.body;
    if (!justificativa || !justificativa.trim()) {
      return res.status(400).json({ error: 'Justificativa obrigatória' });
    }
    const result = await ReaberturaService.recusarReabertura(
      req.params.rid, justificativa, req.usuario.nome
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Concluir ciclo (controldesk ou admin)
router.patch('/reaberturas/:rid/concluir', autorizar('controldesk'), async (req, res) => {
  try {
    const { descricao_final, link_referencia, justificativa } = req.body;
    if (!descricao_final || !descricao_final.trim()) {
      return res.status(400).json({ error: 'Descrição obrigatória' });
    }
    const result = await ReaberturaService.concluirReabertura(
      req.params.rid, descricao_final, link_referencia, justificativa
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
