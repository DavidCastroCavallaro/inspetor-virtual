/* Evaluator Agent - vida util / depreciacao por tabela fixa (referencia IBAPE / Ross-Heidecke).
   Sem chamadas de IA. */

const VIDA_UTIL = [
  { re: /transformador/i, anos: 30 },
  { re: /compressor/i, anos: 20 },
  { re: /bomba/i, anos: 15 },
  { re: /motor|indu(c|ç)ao|el(e|é)trico/i, anos: 20 },
  { re: /redutor|gearbox/i, anos: 25 },
  { re: /ventilador|exaustor/i, anos: 15 },
  { re: /gerador/i, anos: 25 },
  { re: /painel|quadro/i, anos: 20 },
];
const VIDA_UTIL_DEFAULT = 20;

// Fator de estado - fallback grosseiro (3 niveis) quando nao ha estadoConservacao (a-i) informado
const FATOR_ESTADO = { Bom: 0.03, Regular: 0.18, Ruim: 0.52 };

// Escala de Estado de Conservacao (Heidecke/IBAPE) - 9 niveis, preenchida pelo perito em campo.
// "fator" e o coeficiente de depreciacao do proprio estado (0 = novo, 1 = sem valor).
export const ESTADOS_CONSERVACAO = [
  { codigo: 'a', label: 'Nova', fator: 0 },
  { codigo: 'b', label: 'Entre nova e regular', fator: 0.0252 },
  { codigo: 'c', label: 'Regular', fator: 0.0809 },
  { codigo: 'd', label: 'Entre regular e necessitando reparos simples', fator: 0.181 },
  { codigo: 'e', label: 'Necessitando de reparos simples', fator: 0.3174 },
  { codigo: 'f', label: 'Necessitando de reparos simples a Importantes', fator: 0.4846 },
  { codigo: 'g', label: 'Necessitando de reparos importantes', fator: 0.681 },
  { codigo: 'h', label: 'Necessitando reparos Importantes a edificação sem valor', fator: 0.8842 },
  { codigo: 'i', label: 'Sem valor', fator: 1 },
];

function vidaUtilPorTipo(desc) {
  for (const v of VIDA_UTIL) if (v.re.test(desc || '')) return v.anos;
  return VIDA_UTIL_DEFAULT;
}

export function evaluate({ descricao, anoFabricacao, condicao, estadoConservacao }, anoBase = new Date().getFullYear()) {
  const vidaUtilTotalAnos = vidaUtilPorTipo(descricao);
  const ano = parseInt(String(anoFabricacao).match(/\d{4}/)?.[0] || '', 10);
  const idadeAnos = Number.isFinite(ano) ? Math.max(0, anoBase - ano) : Math.round(vidaUtilTotalAnos * 0.4);

  const depFisica = Math.min(1, idadeAnos / vidaUtilTotalAnos); // linha reta

  // estado observado (a-i) tem prioridade sobre a estimativa grosseira da IA (Bom/Regular/Ruim)
  const estado = ESTADOS_CONSERVACAO.find((e) => e.codigo === estadoConservacao);
  const fatorEstado = estado ? estado.fator : (FATOR_ESTADO[condicao] ?? FATOR_ESTADO.Regular);

  // Ross-Heidecke: k = dep + (1 - dep) * fatorEstado
  const k = Math.min(1, depFisica + (1 - depFisica) * fatorEstado);

  const depreciacaoPct = Math.round(k * 1000) / 10;
  const vidaRemanescenteAnos = Math.max(0, Math.round((vidaUtilTotalAnos * (1 - k)) * 10) / 10);

  return {
    vidaUtilTotalAnos,
    idadeAnos,
    depreciacaoPct,
    vidaRemanescenteAnos,
    estadoConservacao: estado?.codigo || null,
    metodo: 'Linha reta + Ross-Heidecke (estado) - ref. IBAPE',
  };
}
