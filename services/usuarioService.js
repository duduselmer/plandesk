const db = require('../db/connection');
const bcrypt = require('bcryptjs');

class UsuarioService {

  // Listar todos os usuários
  static listarUsuarios() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, nome, email, nivel, ativo, criado_em FROM usuarios ORDER BY id`,
        [],
        (err, rows) => resolve(rows || [])
      );
    });
  }

  // Buscar usuário por ID
  static buscarPorId(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, nome, email, nivel, ativo FROM usuarios WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  // Criar usuário
  static criarUsuario(nome, email, senha, nivel) {
    return new Promise((resolve, reject) => {
      const hash = bcrypt.hashSync(senha, 10);
      db.run(
        'INSERT INTO usuarios (nome, email, senha_hash, nivel) VALUES (?, ?, ?, ?)',
        [nome, email.toLowerCase().trim(), hash, nivel],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) return reject(new Error('Email já cadastrado'));
            return reject(err);
          }
          resolve({ id: this.lastID, nome, email, nivel });
        }
      );
    });
  }

  // Atualizar usuário
  static atualizarUsuario(id, dados) {
    return new Promise((resolve, reject) => {
      const campos = [];
      const params = [];

      if (dados.nome) { campos.push('nome = ?'); params.push(dados.nome); }
      if (dados.email) { campos.push('email = ?'); params.push(dados.email.toLowerCase().trim()); }
      if (dados.nivel) { campos.push('nivel = ?'); params.push(dados.nivel); }
      if (dados.senha) {
        campos.push('senha_hash = ?');
        params.push(bcrypt.hashSync(dados.senha, 10));
      }
      if (dados.ativo !== undefined) { campos.push('ativo = ?'); params.push(dados.ativo); }

      if (campos.length === 0) return resolve({ message: 'Nada para atualizar' });

      params.push(id);
      db.run(
        `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) return reject(err);
          resolve({ message: 'Usuário atualizado' });
        }
      );
    });
  }

  // Listar setores de origem
  static listarSetoresOrigem() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM setores_origem ORDER BY nome', [], (err, rows) => resolve(rows || []));
    });
  }

  // Listar setores de destino
  static listarSetoresDestino() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM setores_destino ORDER BY nome', [], (err, rows) => resolve(rows || []));
    });
  }

  // Criar setor de origem
  static criarSetorOrigem(nome) {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO setores_origem (nome) VALUES (?)', [nome], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, nome });
      });
    });
  }

  // Criar setor de destino
  static criarSetorDestino(nome) {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO setores_destino (nome) VALUES (?)', [nome], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, nome });
      });
    });
  }

  // Remover setor de origem
  static removerSetorOrigem(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM setores_origem WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        db.run('DELETE FROM usuario_setores_origem WHERE setor_id = ?', [id]);
        resolve({ message: 'Setor removido' });
      });
    });
  }

  // Remover setor de destino
  static removerSetorDestino(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM setores_destino WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        db.run('DELETE FROM usuario_setores_destino WHERE setor_id = ?', [id]);
        resolve({ message: 'Setor removido' });
      });
    });
  }

  // Vincular setor de origem ao usuário
  static vincularSetorOrigem(usuarioId, setorId) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO usuario_setores_origem (usuario_id, setor_id) VALUES (?, ?)',
        [usuarioId, setorId],
        function(err) {
          if (err) return reject(err);
          resolve({ message: 'Setor vinculado' });
        }
      );
    });
  }

  // Desvincular setor de origem do usuário
  static desvincularSetorOrigem(usuarioId, setorId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM usuario_setores_origem WHERE usuario_id = ? AND setor_id = ?',
        [usuarioId, setorId],
        function(err) {
          if (err) return reject(err);
          resolve({ message: 'Setor desvinculado' });
        }
      );
    });
  }

  // Vincular setor de destino ao usuário
  static vincularSetorDestino(usuarioId, setorId) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO usuario_setores_destino (usuario_id, setor_id) VALUES (?, ?)',
        [usuarioId, setorId],
        function(err) {
          if (err) return reject(err);
          resolve({ message: 'Setor vinculado' });
        }
      );
    });
  }

  // Desvincular setor de destino do usuário
  static desvincularSetorDestino(usuarioId, setorId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM usuario_setores_destino WHERE usuario_id = ? AND setor_id = ?',
        [usuarioId, setorId],
        function(err) {
          if (err) return reject(err);
          resolve({ message: 'Setor desvinculado' });
        }
      );
    });
  }

  // Listar setores de origem de um usuário
  static listarSetoresOrigemDoUsuario(usuarioId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT s.id, s.nome FROM usuario_setores_origem us 
         JOIN setores_origem s ON us.setor_id = s.id 
         WHERE us.usuario_id = ? ORDER BY s.nome`,
        [usuarioId],
        (err, rows) => resolve(rows || [])
      );
    });
  }

  // Listar setores de destino de um usuário
  static listarSetoresDestinoDoUsuario(usuarioId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT s.id, s.nome FROM usuario_setores_destino us 
         JOIN setores_destino s ON us.setor_id = s.id 
         WHERE us.usuario_id = ? ORDER BY s.nome`,
        [usuarioId],
        (err, rows) => resolve(rows || [])
      );
    });
  }

  // Listar níveis disponíveis
  static listarNiveis() {
    return [
      { nome: 'requisitor', poder: 1, telas: ['solicitante'] },
      { nome: 'supervisor', poder: 2, telas: ['solicitante', 'historico', 'configuracoes'] },
      { nome: 'controldesk', poder: 3, telas: ['solicitante', 'analista', 'gestao'] },
      { nome: 'gerente', poder: 4, telas: ['solicitante', 'analista', 'gestao', 'historico', 'configuracoes'] },
      { nome: 'admin', poder: 5, telas: ['solicitante', 'analista', 'gestao', 'historico', 'configuracoes'] }
    ];
  }
}

module.exports = UsuarioService;
