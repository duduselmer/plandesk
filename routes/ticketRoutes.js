const express = require('express');
const router = express.Router();
const TicketService = require('../services/ticketService');

// Middleware para identificar perfil
const identificarPerfil = (req, res, next) => {
  req.perfil = (req.headers['x-perfil'] || 'solicitante').toLowerCase();
  req.usuario = req.headers['x-usuario'] || 'anônimo';
  next();
};

router.use(identificarPerfil);

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
    
    const resultado = await TicketService.criarTicket(setor, nome, descricao);
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
    
    const tickets = await TicketService.listarTickets(filtros);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas
router.get('/stats/geral', async (req, res) => {
  try {
    if (req.perfil !== 'gestao' && req.perfil !== 'analista') {
      return res.status(403).json({ error: 'Acesso restrito' });
    }
    
    const stats = await TicketService.obterEstatisticas();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lixeira
router.get('/lixeira/listar', async (req, res) => {
  try {
    if (req.perfil !== 'gestao' && req.perfil !== 'analista') {
      return res.status(403).json({ error: 'Acesso restrito' });
    }
    
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

// Iniciar atendimento
router.patch('/:id/start', async (req, res) => {
  try {
    if (req.perfil !== 'analista') {
      return res.status(403).json({ error: 'Apenas analistas podem iniciar tickets' });
    }
    
    const { prioridade } = req.body;
    if (!prioridade) {
      return res.status(400).json({ error: 'Prioridade é obrigatória' });
    }
    
    const resultado = await TicketService.iniciarTicket(
      req.params.id,
      prioridade,
      req.usuario
    );
    
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Concluir ticket
router.patch('/:id/finish', async (req, res) => {
  try {
    if (req.perfil !== 'analista') {
      return res.status(403).json({ error: 'Apenas analistas podem concluir tickets' });
    }
    
    const { descricao_final, justificativa, link_referencia } = req.body;
    
    if (!descricao_final || !descricao_final.trim()) {
      return res.status(400).json({ error: 'Descrição final da solução é obrigatória' });
    }
    
    const resultado = await TicketService.concluirTicket(
      req.params.id,
      descricao_final,
      justificativa,
      link_referencia
    );
    
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reabrir ticket
router.patch('/:id/reopen', async (req, res) => {
  try {
    const { motivo } = req.body;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Motivo da reabertura é obrigatório' });
    }

    // Verificar se o ticket original permite reabertura
    const ticket = await TicketService.buscarTicketPorId(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'concluído') {
      return res.status(400).json({ error: 'Apenas tickets concluídos podem ser reabertos' });
    }

    // Verificar se já existe reabertura recusada
    const reaberturasRecusadas = await TicketService.verificarReaberturasRecusadas(req.params.id);
    if (reaberturasRecusadas) {
      return res.status(400).json({ 
        error: 'Não é possível solicitar reabertura. Uma reabertura anterior foi recusada pelo analista.' 
      });
    }

    // Verificar limite de reaberturas (máximo 2 = 3 ciclos)
    const totalCiclos = await TicketService.contarCiclos(req.params.id);
    if (totalCiclos >= 3) {
      return res.status(400).json({ 
        error: 'Limite máximo de reaberturas atingido (2 reaberturas por ticket).' 
      });
    }

    const resultado = await TicketService.reabrirTicket(req.params.id, motivo);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Aceitar reabertura
router.patch('/:id/accept-reopen', async (req, res) => {
  try {
    if (req.perfil !== 'analista') {
      return res.status(403).json({ error: 'Apenas analistas podem aceitar reabertura' });
    }
    
    const { prioridade } = req.body;
    if (!prioridade) {
      return res.status(400).json({ error: 'Prioridade é obrigatória' });
    }
    
    const resultado = await TicketService.aceitarReabertura(
      req.params.id,
      prioridade,
      req.usuario
    );
    
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Recusar reabertura
router.patch('/:id/refuse-reopen', async (req, res) => {
  try {
    if (req.perfil !== 'analista') {
      return res.status(403).json({ error: 'Apenas analistas podem recusar reabertura' });
    }
    
    const { justificativa } = req.body;
    if (!justificativa || !justificativa.trim()) {
      return res.status(400).json({ error: 'Justificativa é obrigatória para recusar' });
    }
    
    const resultado = await TicketService.recusarReabertura(req.params.id, justificativa);
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
      req.params.id,
      req.perfil,
      req.usuario,
      motivo
    );
    
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
