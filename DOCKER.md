# Rodar com Docker

Sobe a aplicação inteira (API + PWA) com um comando.

## Pré-requisitos
- Docker + Docker Compose (Docker Desktop no Windows/Mac já inclui os dois)
- `backend/.env` preenchido. Se não existir:
  ```bash
  copy backend\.env.example backend\.env
  ```
  Sem `ANTHROPIC_API_KEY`, o app roda em **MODO MOCK** (custo zero).

## Subir
```bash
docker compose up -d --build
```
- PWA:  http://localhost:8080
- API:  http://localhost:8787/api/health

## Parar
```bash
docker compose down
```
Os dados (projetos, capturas, resultados) ficam em `backend/data/db.json` no host — sobrevivem a `down`/`up`.

## Ver logs
```bash
docker compose logs -f
docker compose logs -f backend
```

## Reconstruir após mudar o código
```bash
docker compose up -d --build
```

## Serviços (docker-compose.yml)
| Serviço  | Imagem base      | Porta host | O que faz |
|----------|------------------|------------|-----------|
| backend  | node:22-alpine   | 8787       | API Express + pipeline de IA |
| frontend | nginx:alpine     | 8080       | PWA (build Vite) + proxy `/api` → backend |

O frontend fala com o backend pela rede interna do Compose (`http://backend:8787`);
a porta 8787 no host é exposta só para testes diretos da API.

## HTTPS (câmera/microfone no celular)
Navegadores só liberam câmera e microfone em `localhost` ou HTTPS. Para usar no
celular via IP da rede, coloque um TLS na frente da porta 8080:

- **Túnel rápido:** `cloudflared tunnel --url http://localhost:8080`
- **Reverse proxy:** Caddy/Traefik/nginx com certificado apontando para `frontend:80`

## Deploy num servidor
1. Copie a pasta `inspetor-virtual/` (sem `node_modules`).
2. Crie `backend/.env` com as chaves de produção.
3. `docker compose up -d --build`
4. Ponha um proxy TLS público na frente da porta 8080.
