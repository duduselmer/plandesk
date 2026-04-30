const db = require('../db/connection');
const SLAService = require('./slaService');

class ReaberturaService {
  /**
   * Verificar se ticket pode solicitar reabertura
   */
  static podeSolicitarReabertura(ticketId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM tickets WHERE id = ? AND deletado = 0', [ticketId], (err, ticket) => {
        if (err) return reject(err);
        if (!ticket || ticket.status !== 'concluído') return resolve({ pode: false, motivo: 'Ticket não está concluído' });
        if (ticket.max_reaberturas_atingido) return resolve({ pode: false, motivo: 'Limite máximo de reaberturas atingido' });

        const proximoCiclo = ticket.reaberturas_aceitas + 2; // ciclo 2 ou 3
        
        // Contar tentativas já feitas para o próximo ciclo
        db.get(
          `SELECT COUNT(*) as count FROM reaberturas WHERE ticket_id = ? AND ciclo = ? AND status IN ('pendente', 'recusada')`,
          [ticketId, proximoCiclo],
          (err, row) => {
            if (err) return reject(err);
            
            const tentativasUsadas = row.count;
            if (tentativasUsadas >= 2) {
              return resolve({ pode: false, motivo: 'Limite de 2 tentativas para este ciclo' });
            }
            
            // Verificar se já tem pendente
            db.get(
              `SELECT id FROM reaberturas WHERE ticket_id = ? AND status = 'pendente'`,
              [ticketId],
              (err, pendente) => {
                if (err) return reject(err);
                if (pendente) return resolve({ pode: false, motivo: 'Já existe uma reabertura pendente' });
                
                resolve({ 
                  pode: true, 
                  proximoCiclo, 
                  tentativa: tentativasUsadas + 1,
                  tentativasRestantes: 2 - tentativasUsadas 
                });
              }
            );
          }
        );
      });
    });
  }

  /**
   * Solicitante solicita reabertura
   */
  static solicitarReabertura(ticketId, motivo) {
    return new Promise((resolve, reject) => {
      this.podeSolicitarReabertura(ticketId).then(result => {
        if (!result.pode) return reject(new Error(result.motivo));

        const sql = `
          INSERT INTO reaberturas (ticket_id, ciclo, tentativa_ciclo, solicitado_em, motivo_solicitacao, status)
          VALUES (?, ?, ?, datetime('now', 'localtime'), ?, 'pendente')
        `;

        db.run(sql, [ticketId, result.proximoCiclo, result.tentativa, motivo], function(err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            message: 'Reabertura solicitada com sucesso. Aguardando analista.',
            ticket_id: ticketId,
            ciclo: result.proximoCiclo,
            tentativa: result.tentativa
          });
        });
      }).catch(reject);
    });
  }

  /**
   * Solicitante cancela solicitação pendente
   */
  static cancelarSolicitacao(reaberturaId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE reaberturas SET status = 'cancelada', cancelado_em = datetime('now', 'localtime') WHERE id = ? AND status = 'pendente'`,
        [reaberturaId],
        function(err) {
          if (err) return reject(err);
          if (this.changes === 0) return reject(new Error('Reabertura não encontrada ou não está pendente'));
          resolve({ message: 'Solicitação cancelada' });
        }
      );
    });
  }

  /**
   * Analista aceita reabertura
   */
  static aceitarReabertura(reaberturaId, prioridade, analista) {
    return new Promise((resolve, reject) => {
      const prioridadesValidas = ['Baixa', 'Média', 'Alta', 'Crítica'];
      if (!prioridadesValidas.includes(prioridade)) {
        return reject(new Error('Prioridade inválida'));
      }

      db.get(`SELECT * FROM reaberturas WHERE id = ? AND status = 'pendente'`, [reaberturaId], (err, reab) => {
        if (err) return reject(err);
        if (!reab) return reject(new Error('Reabertura não encontrada ou não está pendente'));

        const slaTotal = SLAService.calcularSLATotal(prioridade);
        const agora = new Date().toISOString();

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Atualizar reabertura como aceita e iniciada
          db.run(`
            UPDATE reaberturas 
            SET status = 'aceita', 
                analista_responsavel = ?, 
                prioridade = ?, 
                decidido_em = ?, 
                iniciado_em = ?,
                sla_total_min = ?
            WHERE id = ?`,
            [analista, prioridade, agora, agora, slaTotal, reaberturaId],
            (err) => {
              if (err) { db.run('ROLLBACK'); return reject(err); }

              // Atualizar ticket original
              const novasAceitas = reab.ciclo - 1; // ciclo 2 = 1 aceita, ciclo 3 = 2 aceitas
              const maxAtingido = reab.ciclo >= 3 ? 1 : 0;

              db.run(`
                UPDATE tickets 
                SET reaberturas_aceitas = ?, 
                    ciclo_atual = ?,
                    max_reaberturas_atingido = ?,
                    ultima_atualizacao = ?
                WHERE id = ?`,
                [novasAceitas, reab.ciclo, maxAtingido, agora, reab.ticket_id],
                (err) => {
                  if (err) { db.run('ROLLBACK'); return reject(err); }
                  db.run('COMMIT');

                  resolve({
                    message: `Reabertura aceita - Ciclo ${reab.ciclo} iniciado`,
                    ticket_id: reab.ticket_id,
                    ciclo: reab.ciclo,
                    sla_total_min: slaTotal,
                    prioridade
                  });
                }
              );
            }
          );
        });
      });
    });
  }

  /**
   * Analista recusa reabertura
   */
  static recusarReabertura(reaberturaId, justificativa, analista) {
    return new Promise((resolve, reject) => {
      const agora = new Date().toISOString();

      db.get(`SELECT * FROM reaberturas WHERE id = ? AND status = 'pendente'`, [reaberturaId], (err, reab) => {
        if (err) return reject(err);
        if (!reab) return reject(new Error('Reabertura não encontrada ou não está pendente'));

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(`
            UPDATE reaberturas 
            SET status = 'recusada', 
                analista_responsavel = ?, 
                justificativa_recusa = ?, 
                decidido_em = ?
            WHERE id = ?`,
            [analista, justificativa, agora, reaberturaId],
            (err) => {
              if (err) { db.run('ROLLBACK'); return reject(err); }

              // Verificar se esgotou tentativas para este ciclo
              db.get(
                `SELECT COUNT(*) as count FROM reaberturas WHERE ticket_id = ? AND ciclo = ? AND status IN ('recusada', 'pendente')`,
                [reab.ticket_id, reab.ciclo],
                (err, row) => {
                  if (err) { db.run('ROLLBACK'); return reject(err); }

                  // Se 2 recusadas no mesmo ciclo, bloqueia novas solicitações
                  if (row.count >= 2) {
                    db.run(
                      `UPDATE tickets SET max_reaberturas_atingido = 1 WHERE id = ?`,
                      [reab.ticket_id]
                    );
                  }

                  db.run('COMMIT');
                  resolve({ message: 'Reabertura recusada' });
                }
              );
            }
          );
        });
      });
    });
  }

  /**
   * Analista conclui ciclo de reabertura
   */
  static concluirReabertura(reaberturaId, descricaoFinal, linkRef, justificativaSLA) {
    return new Promise((resolve, reject) => {
      const agora = new Date();
      const agoraISO = agora.toISOString();

      db.get(`SELECT * FROM reaberturas WHERE id = ? AND status = 'aceita'`, [reaberturaId], (err, reab) => {
        if (err) return reject(err);
        if (!reab) return reject(new Error('Reabertura não encontrada ou não está ativa'));

        const slaConsumido = SLAService.calcularMinutosUteis(new Date(reab.iniciado_em), agora);
        const slaEstourado = slaConsumido > reab.sla_total_min ? 1 : 0;

        if (slaEstourado && (!justificativaSLA || !justificativaSLA.trim())) {
          return reject(new Error('SLA estourado. Justificativa obrigatória.'));
        }

        db.run(`
          UPDATE reaberturas 
          SET descricao_final = ?, 
              link_referencia = ?, 
              concluido_em = ?,
              sla_consumido_min = ?,
              sla_estourado = ?,
              sla_justificativa = ?
          WHERE id = ?`,
          [descricaoFinal, linkRef || null, agoraISO, slaConsumido, slaEstourado, justificativaSLA || null, reaberturaId],
          function(err) {
            if (err) return reject(err);
            resolve({ message: 'Ciclo concluído', sla_consumido_min: slaConsumido, sla_estourado: slaEstourado });
          }
        );
      });
    });
  }

  /**
   * Listar reaberturas de um ticket
   */
  static listarReaberturas(ticketId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM reaberturas WHERE ticket_id = ? ORDER BY id ASC`,
        [ticketId],
        (err, rows) => resolve(rows || [])
      );
    });
  }

  /**
   * Buscar reaberturas pendentes para o analista
   */
  static listarPendentes() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT r.*, t.setor, t.nome, t.descricao, t.descricao_final as solucao_anterior
         FROM reaberturas r 
         JOIN tickets t ON r.ticket_id = t.id 
         WHERE r.status = 'pendente' AND t.deletado = 0
         ORDER BY r.solicitado_em ASC`,
        [],
        (err, rows) => resolve(rows || [])
      );
    });
  }
}

module.exports = ReaberturaService;
