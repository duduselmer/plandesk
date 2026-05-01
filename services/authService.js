const db = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'plandesk_secret_key_2026';
const JWT_EXPIRES = '8h';

class AuthService {
  /**
   * Login do usuário
   * @param {string} email
   * @param {string} senha
   * @returns {Promise<{token, perfil, nome}>}
   */

  static login(email, senha) {
    return new Promise((resolve, reject) => {
      if (!email || !senha) {
        return reject(new Error('Email e senha são obrigatórios'));
      }

      db.get(
        'SELECT * FROM usuarios WHERE email = ? AND ativo = 1',
        [email.toLowerCase().trim()],
        (err, user) => {
          if (err) return reject(new Error('Erro ao buscar usuário'));
          if (!user) return reject(new Error('Email ou senha inválidos'));

          bcrypt.compare(senha, user.senha_hash, (err, match) => {
            if (err || !match) return reject(new Error('Email ou senha inválidos'));

            // Buscar perfis do usuário
            db.all(
              'SELECT perfil FROM usuario_perfis WHERE usuario_id = ?',
              [user.id],
              (err, rows) => {
                if (err) return reject(new Error('Erro ao buscar perfis'));

                const perfis = rows.map(r => r.perfil);
                
                const token = jwt.sign(
                  { id: user.id, nome: user.nome, email: user.email },
                  JWT_SECRET,
                  { expiresIn: JWT_EXPIRES }
                );

                resolve({
                  token,
                  nome: user.nome,
                  email: user.email,
                  perfis: perfis.length > 0 ? perfis : [user.perfil]
                });
              }
            );
          });
        }
      );
    });
  }
  
  /**
   * Verifica se um token JWT é válido
   * @param {string} token
   * @returns {object} payload decodificado
   */
  static verificarToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token expirado. Faça login novamente.');
      }
      throw new Error('Token inválido');
    }
  }

  /**
   * Buscar usuário por ID
   */
  static buscarPorId(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ?',
        [id],
        (err, user) => {
          if (err) return reject(err);
          resolve(user || null);
        }
      );
    });
  }

  /**
   * Criar novo usuário (para admin/gestão)
   */
  static criarUsuario(nome, email, senha, perfil) {
    return new Promise((resolve, reject) => {
      const perfisValidos = ['solicitante', 'analista', 'gestao'];
      if (!perfisValidos.includes(perfil)) {
        return reject(new Error('Perfil inválido'));
      }

      const hash = bcrypt.hashSync(senha, 10);

      db.run(
        'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
        [nome, email.toLowerCase().trim(), hash, perfil],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return reject(new Error('Email já cadastrado'));
            }
            return reject(new Error('Erro ao criar usuário'));
          }
          resolve({ id: this.lastID, nome, email, perfil });
        }
      );
    });
  }
}

module.exports = AuthService;
