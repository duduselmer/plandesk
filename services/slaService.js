// Horários de trabalho (em minutos desde 00:00)
const HORA_INICIO = 8 * 60;      // 08:00
const HORA_FIM = 17 * 60 + 48;   // 17:48

// Pausas (em minutos desde 00:00)
const PAUSAS = [
  { inicio: 11 * 60 + 30, fim: 11 * 60 + 40 },  // 11:30 - 11:40
  { inicio: 12 * 60,      fim: 13 * 60 },       // 12:00 - 13:00
  { inicio: 16 * 60 + 30, fim: 16 * 60 + 40 }   // 16:30 - 16:40
];

// SLA por prioridade (em minutos)
const SLA_POR_PRIORIDADE = {
  'Baixa': 240,
  'Média': 120,
  'Alta': 60,
  'Crítica': 30
};

class SLAService {
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
        // Próximo dia útil às 08:00
        proximo.setDate(proximo.getDate() + 1);
        proximo.setHours(8, 0, 0, 0);
        
        while (proximo.getDay() === 0 || proximo.getDay() === 6) {
          proximo.setDate(proximo.getDate() + 1);
        }
      } else if (this.estaEmPausa(proximo)) {
        // Avança para o fim da pausa
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
   * Calcula o SLA total baseado na prioridade
   */
  static calcularSLATotal(prioridade) {
    return SLA_POR_PRIORIDADE[prioridade] || 60;
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
    
    let tentativas = 0;
    const MAX_TENTATIVAS = 100000;
    
    while (inicio < fim && tentativas < MAX_TENTATIVAS) {
      tentativas++;
      
      const proximo = this.proximoHorarioUtil(inicio);
      
      if (proximo > fim) {
        if (this.estaEmHorarioUtil(inicio)) {
          minutos += (fim - inicio) / 60000;
        }
        break;
      }
      
      if (this.estaEmHorarioUtil(inicio)) {
        minutos += (proximo - inicio) / 60000;
      }
      
      inicio = proximo;
    }
    
    return Math.round(minutos);
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
   * Retorna tempos de SLA por prioridade para relatórios
   */
  static getSLAPorPrioridade() {
    return { ...SLA_POR_PRIORIDADE };
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
