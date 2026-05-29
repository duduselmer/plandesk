const db = require('../db/connection');

// GET - Buscar SLA do banco
router.get('/config', (req, res) => {
  db.all("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'sla_%'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const slaConfig = {
      'Crítica': 30,
      'Alta': 60,
      'Média': 120,
      'Baixa': 240
    };
    
    rows.forEach(row => {
      const prio = row.chave.replace('sla_', '');
      slaConfig[prio] = parseInt(row.valor);
    });
    
    res.json(slaConfig);
  });
});

// PUT - Salvar SLA no banco
router.put('/config', (req, res) => {
  const { prioridade, minutos } = req.body;
  
  if (!prioridade || !minutos) {
    return res.status(400).json({ error: 'Prioridade e minutos são obrigatórios' });
  }
  
  db.run(
    "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)",
    [`sla_${prioridade}`, String(minutos)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `SLA "${prioridade}" salvo: ${minutos} min` });
    }
  );
});
