// Horários de trabalho (em minutos desde 00:00)
const HORA_INICIO = 8 * 60;      // 08:00
const HORA_FIM = 17 * 60 + 48;   // 17:48

// Pausas (em minutos desde 00:00)
const PAUSAS = [
  { inicio: 11 * 60 + 30, fim: 11 * 60 + 40 },  // 11:30 - 11:40
  { inicio: 12 * 60,      fim: 13 * 60 },       // 12:00 - 13:00
  { inicio: 16 * 60 + 30, fim: 16 * 60 + 40 }   // 16:30 - 16:40
];

// SLA padrão (usado como fallback)
const SLA_PADRAO = {
  'Baixa': 240,
  'Média': 120,
  'Alta': 60,
  'Crítica': 30
};

const db = require('../db/connection');

// Cache do SLA (30 segundos)
let _slaCache = null;
let _slaCacheTime = 0;

class SLAService {
  
  /**
   * Busca a configuração de SLA do banco (com cache de 30s)
   * Se não houver configuração no banco, usa os defaults
   */
  static getSLAPorPrioridade() {
    return new Promise((resolve) => {
      if (_slaCache && (Date.now() - _slaCacheTime) < 30000) {
        return resolve(_slaCache);
      }
      
      db.all(
        "SELECT chave, valor FROM configuracoes WHERE chave LIKE 'sla_%'",
        [],
        (err, rows) => {
          const sla = { ...SLA_PADRAO };
          
          if (!err && rows) {
            rows.forEach(row => {
              const prio = row.chave.replace('sla_', '');
              if (sla.hasOwnProperty(prio)) {
                sla[prio] = parseInt(row.valor) || SLA_PADRAO[prio];
              }
            });
          }
          
          _slaCache = sla;
          _slaCacheTime = Date.now();
          resolve(sla);
        }
      );
    });
  }

  /**
   * Calcula o SLA total baseado na prioridade (com consulta ao banco)
   */
  static async calcularSLATotal(prioridade) {
    const sla = await this.getSLAPorPrioridade();
    return sla[prioridade] || SLA_PADRAO[prioridade] || 60;
  }

  /**
   * Verifica se um horário está dentro de uma pausa
   */
  static estaEmPausa(data) {
    const minutosDoDia = data.getHours() * 60 + data.getMinutes();
    return PAUSAS.some(pausa =>
      minutosDoDia >= pausa.inicio && minutosDoDia < pausa.fim
    );
  }

  /**
   * Verifica se um horário está dentro do horário de trabalho
   */
  static estaEmHorarioUtil(data) {
    const minutosDoDia = data.getHours() * 60 + data.getMinutes();
    const diaSemana = data.getDay();

    if (diaSemana === 0 || diaSemana === 6) return false;
    if (minutosDoDia < HORA_INICIO || minutosDoDia >= HORA_FIM) return false;
    if (this.estaEmPausa(data)) return false;

    return true;
  }

  /**
   * Calcula o próximo horário útil a partir de uma data
   */
  static proximoHorarioUtil(data) {
    let proximo = new Date(data);
    proximo.setSeconds(0, 0);
    proximo.setMinutes(proximo.getMinutes() + 1);

    let tentativas = 0;
    const MAX_TENTATIVAS = 10000;

    while (!this.estaEmHorarioUtil(proximo) && tentativas < MAX_TENTATIVAS) {
      tentativas++;

      const minutosDoDia = proximo.getHours() * 60 + proximo.getMinutes();

      if (minutosDoDia >= HORA_FIM || minutosDoDia < HORA_INICIO) {
        proximo.setDate(proximo.getDate() + 1);
        proximo.setHours(8, 0, 0, 0);

        while (proximo.getDay() === 0 || proximo.getDay() === 6) {
          proximo.setDate(proximo.getDate() + 1);
        }
      } else if (this.estaEmPausa(proximo)) {
        const minutosAtual = proximo.getHours() * 60 + proximo.getMinutes();
        const pausaAtual = PAUSAS.find(p =>
          minutosAtual >= p.inicio && minutosAtual < p.fim
        );

        if (pausaAtual) {
          const horas = Math.floor(pausaAtual.fim / 60);
          const minutos = pausaAtual.fim % 60;
          proximo.setHours(horas, minutos, 0, 0);
        }
      }
    }

    return proximo;
  }

  /**
   * Calcula minutos úteis entre duas datas
   */
  static calcularMinutosUteis(dataInicio, dataFim) {
    if (!dataInicio || !dataFim) return 0;

    let inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    let minutos = 0;

    if (!this.estaEmHorarioUtil(inicio)) {
      inicio = this.proximoHorarioUtil(inicio);
    }

    if (inicio >= fim) return 0;

    while (inicio < fim) {
      const diaAtual = new Date(inicio);
      diaAtual.setHours(Math.floor(HORA_FIM / 60), HORA_FIM % 60, 0, 0);

      const limiteDia = fim < diaAtual ? fim : diaAtual;
      let minNoDia = (limiteDia - inicio) / 60000;

      PAUSAS.forEach(pausa => {
        const pausaInicio = new Date(inicio);
        pausaInicio.setHours(Math.floor(pausa.inicio / 60), pausa.inicio % 60, 0, 0);
        const pausaFim = new Date(inicio);
        pausaFim.setHours(Math.floor(pausa.fim / 60), pausa.fim % 60, 0, 0);

        if (pausaInicio < limiteDia && pausaFim > inicio) {
          const sobreposicaoInicio = inicio > pausaInicio ? inicio : pausaInicio;
          const sobreposicaoFim = limiteDia < pausaFim ? limiteDia : pausaFim;
          const minutosPausa = (sobreposicaoFim - sobreposicaoInicio) / 60000;
          if (minutosPausa > 0) minNoDia -= minutosPausa;
        }
      });

      minutos += minNoDia;

      inicio = new Date(diaAtual);
      inicio.setDate(inicio.getDate() + 1);
      inicio.setHours(8, 0, 0, 0);

      while (inicio.getDay() === 0 || inicio.getDay() === 6) {
        inicio.setDate(inicio.getDate() + 1);
      }
    }

    return Math.round(Math.max(0, minutos));
  }

  /**
   * Calcula o status do SLA para indicadores visuais
   */
  static calcularStatusSLA(slaTotal, slaConsumido) {
    if (!slaTotal || slaConsumido === undefined || slaConsumido === null) return 'ok';

    const percentualConsumido = (slaConsumido / slaTotal) * 100;

    if (percentualConsumido >= 100) return 'estourado';
    if (percentualConsumido >= 80) return 'proximo';
    return 'ok';
  }

  /**
   * Retorna pausas para exibição
   */
  static getPausas() {
    return PAUSAS.map(p => ({
      inicio: `${Math.floor(p.inicio / 60)}:${String(p.inicio % 60).padStart(2, '0')}`,
      fim: `${Math.floor(p.fim / 60)}:${String(p.fim % 60).padStart(2, '0')}`
    }));
  }
}

module.exports = SLAService;
