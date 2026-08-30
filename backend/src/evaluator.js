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

// Fator de estado (Ross-Heidecke simplificado)
const FATOR_ESTADO = { Bom: 0.03, Regular: 0.18, Ruim: 0.52 };

function vidaUtilPorTipo(desc) {
  for (const v of VIDA_UTIL) if (v.re.test(desc || '')) return v.anos;
  return VIDA_UTIL_DEFAULT;
}

export function evaluate({ descricao, anoFabricacao, condicao }, anoBase = new Date().getFullYear()) {
  const vidaUtilTotalAnos = vidaUtilPorTipo(descricao);
  const ano = parseInt(String(anoFabricacao).match(/\d{4}/)?.[0] || '', 10);
  const idadeAnos = Number.isFinite(ano) ? Math.max(0, anoBase - ano) : Math.round(vidaUtilTotalAnos * 0.4);

  const depFisica = Math.min(1, idadeAnos / vidaUtilTotalAnos); // linha reta
  const cond = FATOR_ESTADO[condicao] ?? FATOR_ESTADO.Regular;
  // Ross-Heidecke: k = dep + (1 - dep) * fatorEstado
  const k = Math.min(1, depFisica + (1 - depFisica) * cond);

  const depreciacaoPct = Math.round(k * 1000) / 10;
  const vidaRemanescenteAnos = Math.max(0, Math.round((vidaUtilTotalAnos * (1 - k)) * 10) / 10);

  return {
    vidaUtilTotalAnos,
    idadeAnos,
    depreciacaoPct,
    vidaRemanescenteAnos,
    metodo: 'Linha reta + Ross-Heidecke (estado) - ref. IBAPE',
  };
}
