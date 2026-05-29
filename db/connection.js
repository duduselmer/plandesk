const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

db.serialize(() => {
  
  // ==========================================
  // Tabela de usuários
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      nivel TEXT NOT NULL DEFAULT 'requisitor' CHECK(nivel IN ('requisitor', 'supervisor', 'controldesk', 'gerente', 'admin')),
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ==========================================
  // Tabela de setores de origem (quem ABRE tickets)
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS setores_origem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL,
      prioridade_solicitante INTEGER DEFAULT 0
    )
  `);

  // ==========================================
  // Tabela de setores de destino (quem ATENDE tickets)
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS setores_destino (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE NOT NULL
    )
  `);

  // ==========================================
  // Vínculo usuário x setores de origem
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS usuario_setores_origem (
      usuario_id INTEGER NOT NULL,
      setor_id INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, setor_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (setor_id) REFERENCES setores_origem(id)
    )
  `);

  // ==========================================
  // Vínculo usuário x setores de destino (analistas)
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS usuario_setores_destino (
      usuario_id INTEGER NOT NULL,
      setor_id INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, setor_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (setor_id) REFERENCES setores_destino(id)
    )
  `);

  // ==========================================
  // Seeds: setores padrão
  // ==========================================
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Carteira Assinatura')`);
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Carteira Rescisão')`);
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Carteira Athos')`);
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Monitoria')`);
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Control Desk')`);
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Gerente')`);
  // db.run(`INSERT OR IGNORE INTO setores_origem (nome) VALUES ('Planejamento')`);
  // db.run(`INSERT OR IGNORE INTO setores_destino (nome) VALUES ('Control Desk')`);
  
  // ==========================================
  // Tabela de tickets
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      setor TEXT NOT NULL,
      setor_destino TEXT,
      nome TEXT,
      descricao TEXT NOT NULL,
      
      status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto', 'em andamento', 'concluído', 'recebido')),
      prioridade_sugerida TEXT CHECK(prioridade_sugerida IN ('Baixa', 'Média', 'Alta', 'Crítica')),
      prioridade TEXT CHECK(prioridade IN ('Baixa', 'Média', 'Alta', 'Crítica')),
      
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      criado_por INTEGER,
      iniciado_em TEXT,
      concluido_em TEXT,
      
      sla_total_min INTEGER,
      sla_consumido_min INTEGER DEFAULT 0,
      sla_estourado INTEGER DEFAULT 0,
      sla_justificativa TEXT,
      
      analista_responsavel TEXT,
      descricao_final TEXT,
      link_referencia TEXT,
      
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

  // ==========================================
  // Tabela de reaberturas
  // ==========================================
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

  // ==========================================
  // Tabela de configurações
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `);
  
  // ==========================================
  // Tabela de anexos
  // ==========================================
  db.run(`
    CREATE TABLE IF NOT EXISTS anexos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      nome_original TEXT NOT NULL,
      nome_servidor TEXT NOT NULL,
      tamanho_bytes INTEGER,
      tipo TEXT,
      tipo_upload TEXT DEFAULT 'solicitante' CHECK(tipo_upload IN ('solicitante', 'analista')),
      uploaded_por INTEGER,
      uploaded_em TEXT DEFAULT (datetime('now', '-4 hours')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_anexos_ticket ON anexos(ticket_id)');

  // Seed: usuário admin padrão
  const hash = bcrypt.hashSync('Iaf@2026', 10);
  db.run('INSERT OR IGNORE INTO usuarios (nome, email, senha_hash, nivel) VALUES (?, ?, ?, ?)', 
    ['Admin', 'admin@iaf.com', hash, 'admin']);

  // Índices
  db.run('CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_usuarios_nivel ON usuarios(nivel)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_setor_destino ON tickets(setor_destino)');
  db.run('CREATE INDEX IF NOT EXISTS idx_usuario_setores_origem ON usuario_setores_origem(usuario_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_usuario_setores_destino ON usuario_setores_destino(usuario_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_prioridade ON tickets(prioridade)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_deletado ON tickets(deletado)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_setor ON tickets(setor)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_criado_por ON tickets(criado_por)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reaberturas_ticket ON reaberturas(ticket_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reaberturas_status ON reaberturas(status)');

  db.run("ALTER TABLE tickets ADD COLUMN prioridade_sugerida TEXT", (err) => {});
  db.run("ALTER TABLE setores_origem ADD COLUMN prioridade_solicitante INTEGER DEFAULT 0", (err) => {});
  
});

module.exports = db;
