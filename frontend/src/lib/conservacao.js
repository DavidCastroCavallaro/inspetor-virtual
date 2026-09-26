// Escala de Estado de Conservacao (Heidecke/IBAPE) — 9 niveis (a-i).
// "fator" e o coeficiente de depreciacao do proprio estado (0 = novo, 1 = sem valor),
// usado no metodo Ross-Heidecke: k = depFisica + (1 - depFisica) * fator.
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

export function estadoLabel(codigo) {
  const e = ESTADOS_CONSERVACAO.find((x) => x.codigo === codigo);
  return e ? `${e.codigo.toUpperCase()} — ${e.label}` : '';
}

export function estadoFator(codigo) {
  return ESTADOS_CONSERVACAO.find((x) => x.codigo === codigo)?.fator;
}
