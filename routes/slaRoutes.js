const express = require('express');
const router = express.Router();
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);
router.use(autorizar('admin'));

// Configurações padrão de SLA
let slaConfig = {
  'Crítica': 30,
  'Alta': 60,
  'Média': 120,
  'Baixa': 240
};

router.get('/config', (req, res) => {
  res.json(slaConfig);
});

router.put('/config', (req, res) => {
  const { prioridade, minutos } = req.body;
  
  if (!prioridade || !minutos) {
    return res.status(400).json({ error: 'Prioridade e minutos são obrigatórios' });
  }
  
  if (!slaConfig.hasOwnProperty(prioridade)) {
    return res.status(400).json({ error: 'Prioridade inválida' });
  }
  
  if (minutos < 1 || minutos > 9999) {
    return res.status(400).json({ error: 'Minutos deve estar entre 1 e 9999' });
  }
  
  slaConfig[prioridade] = minutos;
  res.json({ message: `SLA "${prioridade}" atualizado para ${minutos} min`, config: slaConfig });
});

module.exports = router;
