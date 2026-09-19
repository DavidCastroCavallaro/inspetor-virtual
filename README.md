# Inspetor Virtual

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

PWA offline-first para vistoria industrial de ativos com pipeline de IA e roteamento inteligente de custo.

## Rodar (2 terminais)

**Backend** (API + agentes IA — porta 8787):
```bash
cd backend
npm install
npm run seed     # gera data/ativos_exemplo.xlsx
npm run dev
```

**Frontend** (PWA — porta 7000):
```bash
cd frontend
npm install
npm run dev
```

Abra: **https://localhost:7000**

## Modo MOCK (padrão)
Sem chaves de API no `backend/.env`, o app roda 100% simulado (custo zero).
Para IA real, preencha `backend/.env` (copie de `.env.example`):
- `GEMINI_API_KEY` — OCR/visão barato (gemini-1.5-flash), fallback pro só se confiança < 0.8
- `ANTHROPIC_API_KEY` — Claude visão (claude-haiku-4-5 rápido → claude-sonnet-4-6 se confiança < 0.8)
- `OPENAI_API_KEY` — transcrição Whisper

## Economia embutida
- Imagem comprimida no navegador (máx 1024px, JPEG 80%) antes do upload
- 1 única chamada multimodal (foto + transcrição) por ativo
- Prompt strict-JSON (sem texto de conversa) → menos output tokens
- Smart routing: modelo barato primeiro, caro só como fallback
- Evaluator (vida útil / depreciação) por tabela fixa IBAPE — sem IA

## Fluxo
1. **Dashboard** — crie/selecione um **Projeto** (isola lista, capturas e resultados). O 🗑️ apaga o projeto e todos os seus dados da API.
2. **Lista** — importe `backend/data/ativos_exemplo.xlsx` (vai para o projeto ativo)
3. **Capturar** — foto + voz → salva na fila IndexedDB (offline)
4. **Sync** — envia lote → pipeline IA (OCR+voz → Matcher → Evaluator)
5. **Dashboard** — 🟢 Confirmados / 🟡 Divergentes / 🔴 Pendentes / 🟠 Novos
6. **Auditoria** — revisar, "Aceitar IA" ou "Manter Cadastro", exportar Excel + PDF do projeto

## Licença
[MIT](LICENSE) — use, copie e modifique livremente. Nunca comite `backend/.env` (chaves de API).
