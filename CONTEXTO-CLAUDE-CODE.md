# Contexto para o Claude Code — Inspetor Virtual no ambiente da Marsh

Leia isto antes de qualquer coisa. Este pendrive foi montado por outra sessão do
Claude Code, rodando no computador de casa do usuário (David Cavallaro), porque
**o computador da Marsh bloqueia Node.js, Docker e WSL** — não dá pra levantar
um `localhost` do jeito normal. Este documento explica o que já foi construído
pra contornar isso, o que está testado, e o que ainda precisa ser validado
*neste* computador especificamente.

## O aplicativo

**Inspetor Virtual** é um PWA de vistoria industrial de ativos: o consultor
fotografa a placa do equipamento, grava/digita uma observação, e uma pipeline
de IA (Claude) extrai fabricante/modelo/potência/nº série/condição, compara
com uma planilha de ativos esperados (código, patrimônio, descrição), calcula
vida útil remanescente/depreciação (regra fixa, sem IA) e gera Excel + PDF
finais. Código-fonte completo e histórico de commits:
**https://github.com/DavidCastroCavallaro/inspetor-virtual**

## O que tem neste pendrive (D:)

```
D:\
├── node\                       Node.js v24.18.0 portátil (zip, sem instalador)
├── inspetor-virtual\           projeto completo, COM node_modules já instalados
├── iniciar-portatil.bat        <- OPÇÃO A: sobe o app normal usando o Node portátil
│
├── app-navegador\              build estático (dist-standalone) — zero servidor
├── servir-navegador.ps1        servidor HTTP minúsculo em PowerShell puro (.NET
│                               HttpListener) — só serve os arquivos estáticos
├── iniciar-navegador.bat       <- OPÇÃO B: chama o servir-navegador.ps1
├── LEIA-ME-NAVEGADOR.txt       instruções da Opção B pro usuário final
│
└── CONTEXTO-CLAUDE-CODE.md     este arquivo
```

## Opção A — Node.js portátil (`iniciar-portatil.bat`)

O app **normal**, sem nenhuma mudança de código — backend Express (porta 8787)
+ frontend Vite (porta 7000), exatamente como roda em casa. A única diferença
é que usa `D:\node\node.exe` diretamente (caminho completo, sem depender do
Node estar instalado ou no PATH do sistema).

- **Testado e funcionando** no computador de casa (onde o Node não é bloqueado).
- **Risco:** se o bloqueio de TI da Marsh for por AppLocker/WDAC bloqueando o
  binário `node.exe` por hash ou assinatura de publisher (não só "não
  instalado"), essa opção provavelmente **também será bloqueada**, mesmo
  sendo portátil — porque é o mesmo executável.
- **Como testar:** dar duplo-clique em `iniciar-portatil.bat`. Ele mesmo checa
  se `node.exe --version` funciona antes de tentar subir os servidores; se
  travar, vai avisar em vez de abrir janelas vazias.
- Se funcionar: abre `https://localhost:7000` (certificado self-signed —
  aceitar o aviso do navegador).

## Opção B — 100% navegador, sem servidor nenhum (`iniciar-navegador.bat`)

Reescrita do frontend pra rodar **sem nenhum backend**. Tudo roda dentro do
navegador:

| Peça do backend original | Substituído por (no navegador) |
|---|---|
| Express + rotas `/api/*` | `frontend/src/lib/localApi.js` (mesma forma da API, mas lê/escreve IndexedDB direto) |
| `matcher.js` / `evaluator.js` (Node) | copiados sem alteração pra `frontend/src/lib/local{Matcher,Evaluator}.js` — já eram JS puro, zero dependência de Node |
| `ai.js` → Claude via backend | `frontend/src/lib/localAi.js` — chama `api.anthropic.com` **direto do navegador**, com o header `anthropic-dangerous-direct-browser-access: true` |
| Whisper (transcrição de voz) | **removido nesta versão** — o campo de observação precisa ser digitado; a nota de voz grava só pra conferência, não é transcrita |
| `xlsx` (Node, leitura/escrita) | mesma lib `xlsx` (SheetJS), mas usando `{type:'array'}` em vez de `{type:'buffer'}` — funciona igual no browser |
| `pdfkit` (Node, stream) | trocado por `jspdf` (browser) em `frontend/src/lib/localPdf.js` — mesmo conteúdo do relatório, layout refeito manualmente (jsPDF não tem fluxo automático de texto/página como o pdfkit) |

Arquivo de build: `frontend/vite.config.standalone.js` (`base: './'`, define
`VITE_STANDALONE=true`). Gerar de novo com:
```bash
cd frontend
npm run build:standalone   # gera frontend/dist-standalone
```
O roteamento entre modo servidor/standalone fica em `frontend/src/lib/api.js`
(checa `import.meta.env.VITE_STANDALONE`).

### Como funciona no computador de destino
`iniciar-navegador.bat` chama `servir-navegador.ps1`, que abre um
`System.Net.HttpListener` em `http://localhost:7100` servindo os arquivos de
`app-navegador\` (é a pasta `dist-standalone` renomeada) — **sem Node, sem
Docker, sem WSL**, só .NET/PowerShell nativo do Windows. Bind em `localhost`
(loopback) não exige privilégio de admin.

- **Testado e funcionando** no computador de casa: criação de projeto,
  IndexedDB, leitura de xlsx em modo array, escrita de xlsx em modo array e
  geração de PDF via jsPDF — todos confirmados isoladamente. **Não testado
  ainda** dentro do ambiente de bloqueio real da Marsh.
- **Risco 1:** `powershell -ExecutionPolicy Bypass -File ...` pode ser
  bloqueado por GPO. Se travar, o fallback é abrir `app-navegador\index.html`
  direto (duplo-clique) — nenhum script roda, é só HTML/JS estático abrindo
  em `file://`. Nesse modo, `getUserMedia` (gravação de voz) pode não
  funcionar (não crítico — a versão standalone já não transcreve voz mesmo).
  A câmera funciona via `<input type=file capture>`, que **não** exige
  contexto seguro, então deve funcionar em `file://` sem problema.
- **Risco 2 (segurança, não bug):** a chave da Anthropic é digitada e fica
  guardada em IndexedDB **deste navegador**, e vai em texto pro fetch direto
  — qualquer um com F12 nesse computador consegue ler a chave. Isso é uma
  troca conhecida e aceita pelo usuário (não é algo pra "corrigir").

## O que eu (sessão anterior) já verifiquei
- Ambas as opções sobem e respondem no computador de casa.
- Bundle standalone builda sem erro (`npm run build:standalone`).
- Lógica de leitura/escrita de xlsx e geração de PDF testada isoladamente
  fora do navegador também (Node), pra confirmar que os parâmetros
  `{type:'array'}` batem com o que o navegador realmente produz.
- Fluxo completo de criação de projeto testado dentro de um navegador real
  (Chromium via ferramenta de automação), sem erros no console.
- **Não testado:** upload de planilha .xlsx e captura de foto dentro do
  navegador automatizado (limitação da ferramenta de teste, não do código).
  Se algo quebrar nesse fluxo, comece por aí.

## Se algo não funcionar aqui na Marsh
1. Rode cada `.bat` e leia a mensagem de erro na janela preta — ambos os
   scripts foram escritos pra avisar em vez de falhar silenciosamente.
2. Se a Opção A travar no `node.exe --version`, é bloqueio de execução — nem
   tente contornar escondendo/renomeando o binário; é política de segurança
   da empresa, não um bug. Foque na Opção B.
3. Se a Opção B travar no PowerShell, teste abrir
   `D:\app-navegador\index.html` direto — sem depender de script nenhum.
4. `backend/.env` (dentro de `inspetor-virtual\`) tem a `ANTHROPIC_API_KEY`
   real do usuário — não versione, não cole em lugar público.
5. Repositório com todo o histórico e commits explicando cada decisão:
   https://github.com/DavidCastroCavallaro/inspetor-virtual
