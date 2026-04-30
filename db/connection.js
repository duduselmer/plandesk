const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

db.serialize(() => {
  // Tabela principal de tickets
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      setor TEXT NOT NULL CHECK(setor IN ('Carteira Assinatura', 'Carteira Rescisão', 'Control Desk', 'Gerente')),
      nome TEXT,
      descricao TEXT NOT NULL,
      
      status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto', 'em andamento', 'concluído')),
      prioridade TEXT CHECK(prioridade IN ('Baixa', 'Média', 'Alta', 'Crítica')),
      
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      iniciado_em TEXT,
      concluido_em TEXT,
      
      sla_total_min INTEGER,
      sla_consumido_min INTEGER DEFAULT 0,
      sla_estourado INTEGER DEFAULT 0,
      sla_justificativa TEXT,
      
      analista_responsavel TEXT,
      descricao_final TEXT,
      link_referencia TEXT,
      
      -- Controle de reaberturas
      ciclo_atual INTEGER NOT NULL DEFAULT 1,
      reaberturas_aceitas INTEGER NOT NULL DEFAULT 0,
      max_reaberturas_atingido INTEGER DEFAULT 0,
      
      deletado INTEGER NOT NULL DEFAULT 0,
      deletado_por TEXT,
      motivo_exclusao TEXT,
      deletado_em TEXT,
      
      ultima_atualizacao TEXT
    )
  `);

  // Tabela de reaberturas
  db.run(`
    CREATE TABLE IF NOT EXISTS reaberturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      
      ciclo INTEGER NOT NULL,
      tentativa_ciclo INTEGER NOT NULL,
      
      solicitado_em TEXT NOT NULL,
      motivo_solicitacao TEXT NOT NULL,
      cancelado_em TEXT,
      
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'aceita', 'recusada', 'cancelada')),
      analista_responsavel TEXT,
      prioridade TEXT,
      decidido_em TEXT,
      justificativa_recusa TEXT,
      
      iniciado_em TEXT,
      sla_total_min INTEGER,
      sla_consumido_min INTEGER DEFAULT 0,
      sla_estourado INTEGER DEFAULT 0,
      sla_justificativa TEXT,
      
      descricao_final TEXT,
      link_referencia TEXT,
      concluido_em TEXT,
      
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )
  `);

  // Índices
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_prioridade ON tickets(prioridade)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_deletado ON tickets(deletado)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_setor ON tickets(setor)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reaberturas_ticket ON reaberturas(ticket_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reaberturas_status ON reaberturas(status)');
});

module.exports = db;
