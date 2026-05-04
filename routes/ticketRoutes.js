const express = require('express');
const router = express.Router();
const TicketService = require('../services/ticketService');
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);

// Criar ticket
router.post('/', async (req, res) => {
  try {
    const { setor, nome, descricao } = req.body;

    if (!setor || !descricao) {
      return res.status(400).json({ error: 'Setor e descrição são obrigatórios' });
    }

    const setoresValidos = ['Carteira Assinatura', 'Carteira Rescisão', 'Control Desk', 'Gerente'];
    if (!setoresValidos.includes(setor)) {
      return res.status(400).json({ error: 'Setor inválido' });
    }

    const resultado = await TicketService.criarTicket(setor, nome, descricao, req.usuario.id);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar tickets
router.get('/', async (req, res) => {
  try {
    const filtros = {};
    if (req.query.status) filtros.status = req.query.status;
    if (req.query.setor) filtros.setor = req.query.setor;
    if (req.query.prioridade) filtros.prioridade = req.query.prioridade;

    // Se for requisitor ou supervisor, mostrar apenas seus tickets
    if (req.nivel === 'requisitor' || req.nivel === 'supervisor') {
      filtros.criado_por = req.usuario.id;
    }

    const tickets = await TicketService.listarTickets(filtros);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas (controldesk ou admin)
router.get('/stats/geral', autorizar('controldesk'), async (req, res) => {
  try {
    const stats = await TicketService.obterEstatisticas();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lixeira (supervisor, controldesk ou admin)
router.get('/lixeira/listar', autorizar('supervisor'), async (req, res) => {
  try {
    const tickets = await TicketService.listarLixeira();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar ticket por ID
router.get('/:id', async (req, res) => {
  try {
    const ticket = await TicketService.buscarTicketPorId(req.params.id);
    res.json(ticket);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Editar ticket
router.put('/:id', async (req, res) => {
  try {
    const resultado = await TicketService.editarTicket(req.params.id, req.body);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Iniciar atendimento (controldesk ou admin)
router.patch('/:id/start', autorizar('controldesk'), async (req, res) => {
  try {
    const { prioridade } = req.body;
    if (!prioridade) {
      return res.status(400).json({ error: 'Prioridade é obrigatória' });
    }

    const resultado = await TicketService.iniciarTicket(req.params.id, prioridade, req.usuario.nome);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Concluir ticket (controldesk ou admin)
router.patch('/:id/finish', autorizar('controldesk'), async (req, res) => {
  try {
    const { descricao_final, justificativa, link_referencia } = req.body;

    if (!descricao_final || !descricao_final.trim()) {
      return res.status(400).json({ error: 'Descrição final da solução é obrigatória' });
    }

    const resultado = await TicketService.concluirTicket(
      req.params.id, descricao_final, justificativa, link_referencia
    );
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Excluir ticket (soft delete)
router.patch('/:id/delete', async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Motivo da exclusão é obrigatório' });
    }

    const resultado = await TicketService.excluirTicket(
      req.params.id, req.nivel, req.usuario.nome, motivo
    );
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
