const db = require('../db/connection');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAX_ANEXOS_POR_TICKET = 4;
const MAX_ANEXOS_POR_TIPO = 2;
const DIAS_RETENCAO = 90;

class AnexoService {

  /**
   * Salvar anexo no banco
   */
static salvarAnexo(ticketId, nomeOriginal, nomeServidor, tamanho, tipo, usuarioId, tipoUpload) {
    return new Promise((resolve, reject) => {
      const tp = tipoUpload || 'solicitante';
      
      db.get(
        'SELECT COUNT(*) as count FROM anexos WHERE ticket_id = ? AND tipo_upload = ?',
        [ticketId, tp],
        (err, row) => {
          if (err) return reject(err);
          if (row.count >= MAX_ANEXOS_POR_TIPO) {
            const filePath = path.join(UPLOADS_DIR, nomeServidor);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return reject(new Error(`Limite máximo de ${MAX_ANEXOS_POR_TIPO} anexos atingido`));
          }

          db.run(
            'INSERT INTO anexos (ticket_id, nome_original, nome_servidor, tamanho_bytes, tipo, uploaded_por, tipo_upload) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ticketId, nomeOriginal, nomeServidor, tamanho, tipo, usuarioId, tp],
            function(err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, nome_original: nomeOriginal });
            }
          );
        }
      );
    });
  }
  
  /**
   * Listar anexos de um ticket
   */
  static listarAnexos(ticketId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM anexos WHERE ticket_id = ? ORDER BY uploaded_em ASC',
        [ticketId],
        (err, rows) => resolve(rows || [])
      );
    });
  }

  /**
   * Excluir um anexo
   */
  static excluirAnexo(anexoId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM anexos WHERE id = ?', [anexoId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Anexo não encontrado'));

        // Remover arquivo físico
        const filePath = path.join(UPLOADS_DIR, row.nome_servidor);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // Remover do banco
        db.run('DELETE FROM anexos WHERE id = ?', [anexoId], (err) => {
          if (err) return reject(err);
          resolve({ message: 'Anexo removido' });
        });
      });
    });
  }

  /**
   * Limpeza automática: remover anexos de tickets com 90+ dias
   */
  static limparAnexosAntigos() {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - DIAS_RETENCAO);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];

    db.all(
      `SELECT a.* FROM anexos a 
       JOIN tickets t ON a.ticket_id = t.id 
       WHERE t.criado_em < ? AND t.deletado = 1`,
      [dataLimiteStr],
      (err, rows) => {
        if (err) {
          console.error('Erro na limpeza de anexos:', err);
          return;
        }

        rows.forEach(row => {
          const filePath = path.join(UPLOADS_DIR, row.nome_servidor);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Anexo removido: ${row.nome_original} (ID: ${row.id})`);
          }
        });

        db.run(
          `DELETE FROM anexos WHERE id IN (SELECT a.id FROM anexos a JOIN tickets t ON a.ticket_id = t.id WHERE t.criado_em < ? AND t.deletado = 1)`,
          [dataLimiteStr],
          (err) => {
            if (err) console.error('Erro ao limpar anexos do banco:', err);
            else console.log(`Limpeza de anexos concluída. ${rows.length} arquivo(s) removido(s).`);
          }
        );
      }
    );
  }
}

// Executar limpeza a cada 24 horas
setInterval(() => {
  AnexoService.limparAnexosAntigos();
}, 24 * 60 * 60 * 1000);

// Executar na inicialização
setTimeout(() => {
  AnexoService.limparAnexosAntigos();
}, 5000);

module.exports = AnexoService;
