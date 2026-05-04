const express = require('express');
const cors = require('cors');
const path = require('path');
const ticketRoutes = require('./routes/ticketRoutes');
const reaberturaRoutes = require('./routes/reaberturaRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/reabertura', reaberturaRoutes);

// Rotas das páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

app.get('/solicitante', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'solicitante.html'));
});

app.get('/analista', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analista.html'));
});

app.get('/gestao', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gestao.html'));
});

app.get('/historico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'historico.html'));
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
app.listen(PORT, HOST, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║        PlanDesk Rodando 🚀           ║
  ║       http://0.0.0.0:${PORT}            ║
  ║                                      ║
  ║  Perfis:                             ║
  ║  	/solicitante                     ║
  ║  	/analista                        ║
  ║  	/gestao                          ║
  ║  	/historico                       ║
  ╚══════════════════════════════════════╝
  `);
});
