const express = require('express');
const router = express.Router();
const TicketService = require('../services/ticketService');
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);

// Criar ticket
router.post('/', async (req, res) => {
  try {
    const { setor, setor_destino, nome, descricao, prioridade } = req.body;

    if (!setor || !descricao) {
      return res.status(400).json({ error: 'Setor de origem e descrição são obrigatórios' });
    }

    const UsuarioService = require('../services/usuarioService');
    const setoresOrigem = await UsuarioService.listarSetoresOrigem();
    const setorOrigem = setoresOrigem.find(s => s.nome === setor);
    if (!setorOrigem) {
      return res.status(400).json({ error: 'Setor de origem inválido' });
    }

    // Se veio prioridade, verificar se o setor de origem permite
    if (prioridade) {
      if (!setorOrigem.prioridade_solicitante) {
        return res.status(400).json({ error: 'Este setor não permite sugerir prioridade' });
      }
      const prioridadesValidas = ['Baixa', 'Média', 'Alta', 'Crítica'];
      if (!prioridadesValidas.includes(prioridade)) {
        return res.status(400).json({ error: 'Prioridade inválida' });
      }
    }

    const resultado = await TicketService.criarTicket(
      setor, setor_destino, nome, descricao, req.usuario.id, prioridade || null
    );
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

    // Se for controldesk ou gerente, carregar setores de destino
    if (req.nivel === 'controldesk' || req.nivel === 'gerente') {
      const UsuarioService = require('../services/usuarioService');
      const setores = await UsuarioService.listarSetoresDestinoDoUsuario(req.usuario.id);
      if (setores.length > 0) {
        filtros.setores_destino = setores.map(s => s.nome);
      }
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
    const { prioridade, justificativa_prioridade } = req.body;
    if (!prioridade) {
      return res.status(400).json({ error: 'Prioridade é obrigatória' });
    }
    const resultado = await TicketService.iniciarTicket(
      req.params.id, prioridade, req.usuario.nome, justificativa_prioridade || null
    );
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
      req.params.id, descricao_final, justificativa, link_referencia,
      req.usuario.nome, req.nivel
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
    req.params.id, req.nivel, req.usuario.nome, req.usuario.id, motivo
  );
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Confirmar recebimento (solicitante)
router.patch('/:id/receber', async (req, res) => {
  try {
    const resultado = await TicketService.marcarRecebido(req.params.id, req.usuario.id);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
