const db = require('../db/connection');
const SLAService = require('./slaService');

class TicketService {
  static criarTicket(setor, nome, descricao, criadoPor) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO tickets (setor, nome, descricao, status, criado_em, criado_por)
        VALUES (?, ?, ?, 'aberto', datetime('now', 'localtime'), ?)
      `;
      db.run(sql, [setor, nome || null, descricao, criadoPor || null], function(err) {
        if (err) return reject(new Error('Erro ao criar ticket'));
        resolve({ id: this.lastID, message: 'Ticket criado com sucesso' });
      });
    });
  }

  static iniciarTicket(id, prioridade, analista) {
    return new Promise((resolve, reject) => {
      const prioridadesValidas = ['Baixa', 'Média', 'Alta', 'Crítica'];
      if (!prioridadesValidas.includes(prioridade)) {
        return reject(new Error('Prioridade inválida'));
      }
      const slaTotal = SLAService.calcularSLATotal(prioridade);
      const agora = new Date().toISOString();

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.get('SELECT id, status FROM tickets WHERE id = ? AND deletado = 0', [id], (err, ticket) => {
          if (err) { db.run('ROLLBACK'); return reject(err); }
          if (!ticket) { db.run('ROLLBACK'); return reject(new Error('Ticket não encontrado')); }
          if (ticket.status !== 'aberto') { db.run('ROLLBACK'); return reject(new Error('Ticket não pode ser iniciado. Status: ' + ticket.status)); }

          const sql = `
            UPDATE tickets SET status = 'em andamento', prioridade = ?, iniciado_em = ?,
            sla_total_min = ?, sla_consumido_min = 0, sla_estourado = 0,
            analista_responsavel = ?, ultima_atualizacao = ?
            WHERE id = ? AND deletado = 0
          `;
          db.run(sql, [prioridade, agora, slaTotal, analista, agora, id], function(err) {
            if (err) { db.run('ROLLBACK'); return reject(err); }
            if (this.changes === 0) { db.run('ROLLBACK'); return reject(new Error('Falha ao iniciar')); }
            db.run('COMMIT');
            resolve({ message: 'Ticket iniciado', sla_total_min: slaTotal, prioridade });
          });
        });
      });
    });
  }

  static concluirTicket(id, descricaoFinal, justificativaSLA, linkRef) {
    return new Promise((resolve, reject) => {
      const agora = new Date();
      const agoraISO = agora.toISOString();

      db.get('SELECT * FROM tickets WHERE id = ? AND deletado = 0 AND status = ?', [id, 'em andamento'], (err, ticket) => {
        if (err) return reject(err);
        if (!ticket) return reject(new Error('Ticket não encontrado ou não está em andamento'));

        const slaConsumido = SLAService.calcularMinutosUteis(new Date(ticket.iniciado_em), agora);
        const slaEstourado = slaConsumido > ticket.sla_total_min ? 1 : 0;

        if (slaEstourado && (!justificativaSLA || !justificativaSLA.trim())) {
          return reject(new Error('SLA estourado. Justificativa obrigatória.'));
        }

        const sql = `
          UPDATE tickets SET status = 'concluído', concluido_em = ?, sla_consumido_min = ?,
          sla_estourado = ?, sla_justificativa = ?, descricao_final = ?, link_referencia = ?,
          ultima_atualizacao = ? WHERE id = ? AND status = 'em andamento' AND deletado = 0
        `;
        db.run(sql, [agoraISO, slaConsumido, slaEstourado, justificativaSLA || null, descricaoFinal, linkRef || null, agoraISO, id], function(err) {
          if (err) return reject(err);
          if (this.changes === 0) return reject(new Error('Falha ao concluir'));
          resolve({ message: 'Ticket concluído', sla_consumido_min: slaConsumido, sla_estourado: slaEstourado });
        });
      });
    });
  }

  static excluirTicket(id, perfil, usuario, motivo) {
    return new Promise((resolve, reject) => {
      let condicaoStatus;
      if (perfil === 'solicitante') condicaoStatus = "status = 'aberto'";
      else if (perfil === 'analista') condicaoStatus = "status = 'concluído'";
      else return reject(new Error('Perfil não autorizado'));

      const agora = new Date().toISOString();
      const sql = `
        UPDATE tickets SET deletado = 1, deletado_por = ?, motivo_exclusao = ?,
        deletado_em = ?, ultima_atualizacao = ? WHERE id = ? AND ${condicaoStatus} AND deletado = 0
      `;
      db.run(sql, [`${perfil}: ${usuario}`, motivo, agora, agora, id], function(err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error('Exclusão não permitida'));
        resolve({ message: 'Ticket arquivado' });
      });
    });
  }

  static editarTicket(id, dados) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM tickets WHERE id = ? AND status = 'aberto' AND deletado = 0", [id], (err, ticket) => {
        if (err) return reject(err);
        if (!ticket) return reject(new Error('Edição permitida apenas para tickets ABERTOS'));
        const agora = new Date().toISOString();
        const setor = dados.setor || ticket.setor;
        const nome = dados.nome !== undefined ? dados.nome : ticket.nome;
        const descricao = dados.descricao || ticket.descricao;
        db.run('UPDATE tickets SET setor = ?, nome = ?, descricao = ?, ultima_atualizacao = ? WHERE id = ?', [setor, nome, descricao, agora, id], function(err) {
          if (err) return reject(err);
          resolve({ message: 'Ticket atualizado' });
        });
      });
    });
  }

  static listarTickets(filtros = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT id, setor, nome, descricao, status, prioridade, criado_em, iniciado_em, concluido_em,
        sla_total_min, sla_consumido_min, sla_estourado, sla_justificativa, analista_responsavel,
        descricao_final, link_referencia, ciclo_atual, reaberturas_aceitas, max_reaberturas_atingido
        FROM tickets WHERE deletado = 0
      `;
      const params = [];
      if (filtros.status) { sql += ' AND status = ?'; params.push(filtros.status); }
      if (filtros.setor) { sql += ' AND setor = ?'; params.push(filtros.setor); }
      if (filtros.prioridade) { sql += ' AND prioridade = ?'; params.push(filtros.prioridade); }
      if (filtros.criado_por) { sql += ' AND criado_por = ?'; params.push(filtros.criado_por); }
      sql += `
        ORDER BY CASE prioridade WHEN 'Crítica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Média' THEN 3 WHEN 'Baixa' THEN 4 ELSE 5 END, criado_em ASC
      `;
      db.all(sql, params, (err, tickets) => {
        if (err) return reject(err);
        const agora = new Date();
        const ticketsComSLA = tickets.map(ticket => {
          const t = { ...ticket };
          if (t.status === 'em andamento' && t.iniciado_em) {
            t.sla_consumido_atual = SLAService.calcularMinutosUteis(new Date(t.iniciado_em), agora);
            t.sla_status = SLAService.calcularStatusSLA(t.sla_total_min, t.sla_consumido_atual);
          } else if (t.sla_estourado) {
            t.sla_status = 'estourado';
          } else {
            t.sla_status = 'ok';
          }
          return t;
        });
        resolve(ticketsComSLA);
      });
    });
  }

  static buscarTicketPorId(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
        if (err) return reject(err);
        if (!ticket) return reject(new Error('Ticket não encontrado'));
        resolve(ticket);
      });
    });
  }

  static listarLixeira() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM tickets WHERE deletado = 1 ORDER BY deletado_em DESC', [], (err, tickets) => {
        if (err) return reject(err);
        resolve(tickets);
      });
    });
  }

  static obterEstatisticas() {
    return new Promise((resolve, reject) => {
      const stats = {};
      let queriesCompletas = 0;
      const TOTAL_QUERIES = 3;
      const checkComplete = () => { queriesCompletas++; if (queriesCompletas >= TOTAL_QUERIES) resolve(stats); };

      db.get("SELECT COUNT(*) as total FROM tickets WHERE deletado = 0", (err, row) => { if (err) return reject(err); stats.total = row.total; });
      db.all("SELECT status, COUNT(*) as count FROM tickets WHERE deletado = 0 GROUP BY status", (err, rows) => { if (err) return reject(err); stats.por_status = rows; checkComplete(); });
      db.get("SELECT COUNT(*) as count FROM tickets WHERE sla_estourado = 1 AND deletado = 0", (err, row) => { if (err) return reject(err); stats.sla_estourados = row.count; });
      db.all(`SELECT prioridade, ROUND(AVG(sla_consumido_min)) as tempo_medio, COUNT(*) as total FROM tickets WHERE status = 'concluído' AND deletado = 0 AND sla_consumido_min IS NOT NULL AND prioridade IS NOT NULL GROUP BY prioridade`, (err, rows) => { if (err) return reject(err); stats.tempo_medio_prioridade = rows || []; checkComplete(); });
      db.all("SELECT setor, COUNT(*) as count FROM tickets WHERE deletado = 0 GROUP BY setor", (err, rows) => { if (err) return reject(err); stats.por_setor = rows || []; checkComplete(); });
    });
  }
}

module.exports = TicketService;
