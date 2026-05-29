const express = require('express');
const cors = require('cors');
const path = require('path');
const ticketRoutes = require('./routes/ticketRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const reaberturaRoutes = require('./routes/reaberturaRoutes');
const anexoRoutes = require('./routes/anexoRoutes');
const slaRoutes = require('./routes/slaRoutes');
const authRoutes = require('./routes/authRoutes');
const multer = require('multer');

process.env.TZ = 'America/Sao_Paulo';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Criar pasta uploads se não existir
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const tipos = /jpeg|jpg|png|pdf|xlsx|xls|csv|docx|doc/;
    const ext = tipos.test(path.extname(file.originalname).toLowerCase());
    const mime = tipos.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Formatos aceitos: PDF, Excel, Word, Imagens'));
  }
});

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/reabertura', reaberturaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/anexo', anexoRoutes);
app.use('/api/sla', slaRoutes);

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

app.get('/configuracoes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configuracoes.html'));
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
