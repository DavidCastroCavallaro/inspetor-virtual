/* Evaluator Agent - vida util / depreciacao por tabela fixa (IBAPE / Ross-Heidecke).
   Copia do backend/src/evaluator.js — usado no modo standalone (sem servidor). */
import { ESTADOS_CONSERVACAO } from './conservacao.js';

const VIDA_UTIL = [
  { re: /transformador de for[cç]a/i, anos: 40 },
  { re: /transformador/i, anos: 25 },
  { re: /turbo ?gerador|turbina (hidr[aá]ulica|a vapor)/i, anos: 35 },
  { re: /gerador/i, anos: 30 },
  { re: /motor.*(el[eé]trico|indu[cç][aã]o)|motor el[eé]trico/i, anos: 20 },
  { re: /painel|quadro (el[eé]trico|de (comando|controle|distribui[cç][aã]o))/i, anos: 20 },
  { re: /disjuntor|banco de capacitores|barramento|conversor/i, anos: 25 },
  { re: /subesta[cç][aã]o|estrutura(s)? de transmiss[aã]o|poste/i, anos: 40 },

  { re: /bomba de processo/i, anos: 10 },
  { re: /bomba de (alimenta[cç][aã]o|inc[eê]ndio|combust[ií]vel)/i, anos: 20 },
  { re: /bomba/i, anos: 15 },
  { re: /compressor/i, anos: 20 },
  { re: /tanque de (combust[ií]vel|processo|[aá]lcool)|tanque/i, anos: 25 },
  { re: /tubula[cç][aã]o|tubo via|encanamento|gasoduto/i, anos: 25 },

  { re: /caldeira.*(alta press[aã]o|acima de 50)/i, anos: 30 },
  { re: /caldeira/i, anos: 25 },
  { re: /forno (industrial|el[eé]trico|de tratamento t[eé]rmico)|estufa/i, anos: 20 },
  { re: /torre de resfriamento/i, anos: 15 },
  { re: /chiller|c[aâ]mara frigor[ií]fica|condensador|m[aá]quina de gelo/i, anos: 20 },
  { re: /secador/i, anos: 20 },

  { re: /redutor|gearbox/i, anos: 12 },
  { re: /ventilador|exaustor/i, anos: 15 },
  { re: /ponte rolante|talha|guindaste|grua|p[oó]rtico/i, anos: 20 },
  { re: /elevador de (carga|canecas?|passageiros?)/i, anos: 20 },
  { re: /esteira|correia transportadora|transportador(a)?|redler|rosca transportadora/i, anos: 15 },
  { re: /prensa|guilhotina|puncionadeira|calandra/i, anos: 20 },
  { re: /torno|fresadora|furadeira|ret[ií]fica|plaina|mandrilhadora|laminadora/i, anos: 20 },
  { re: /solda|soldagem/i, anos: 10 },
  { re: /moinho|britador/i, anos: 20 },
  { re: /misturador|balan[cç]a/i, anos: 15 },
  { re: /silo/i, anos: 30 },

  { re: /empilhadeira/i, anos: 10 },
  { re: /caminh[aã]o/i, anos: 12 },
  { re: /trator/i, anos: 10 },

  { re: /computador|notebook|impressora|scanner|servidor/i, anos: 5 },

  { re: /impressora (offset|rotativa|flexogr[aá]fica)|encadernadora/i, anos: 20 },
  { re: /tear|carda|filat[oó]rio/i, anos: 25 },
];
const VIDA_UTIL_DEFAULT = 20;

const FATOR_ESTADO = { Bom: 0.03, Regular: 0.18, Ruim: 0.52 };

function vidaUtilPorTipo(desc) {
  for (const v of VIDA_UTIL) if (v.re.test(desc || '')) return v.anos;
  return VIDA_UTIL_DEFAULT;
}

export function evaluate(
  { descricao, anoFabricacao, condicao, estadoConservacao, vidaUtilOverride, vidaUtilOrigem },
  anoBase = new Date().getFullYear()
) {
  const usaOverride = Number(vidaUtilOverride) > 0;
  const vidaUtilTotalAnos = usaOverride ? Number(vidaUtilOverride) : vidaUtilPorTipo(descricao);

  const ano = parseInt(String(anoFabricacao).match(/\d{4}/)?.[0] || '', 10);
  const idadeAnos = Number.isFinite(ano) ? Math.max(0, anoBase - ano) : Math.round(vidaUtilTotalAnos * 0.4);

  const depFisica = Math.min(1, idadeAnos / vidaUtilTotalAnos);

  const estado = ESTADOS_CONSERVACAO.find((e) => e.codigo === estadoConservacao);
  const fatorEstado = estado ? estado.fator : (FATOR_ESTADO[condicao] ?? FATOR_ESTADO.Regular);

  const k = Math.min(1, depFisica + (1 - depFisica) * fatorEstado);

  const depreciacaoPct = Math.round(k * 1000) / 10;
  const vidaRemanescenteAnos = Math.max(0, Math.round((vidaUtilTotalAnos * (1 - k)) * 10) / 10);

  return {
    vidaUtilTotalAnos,
    vidaUtilOrigem: usaOverride ? (vidaUtilOrigem || 'manual') : 'tabela',
    idadeAnos,
    depreciacaoPct,
    vidaRemanescenteAnos,
    estadoConservacao: estado?.codigo || null,
    metodo: 'Linha reta + Ross-Heidecke (estado) - ref. IBAPE',
  };
}
