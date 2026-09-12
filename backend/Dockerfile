# Inspetor Virtual — API (Node + Express)
FROM node:22-alpine

WORKDIR /app

# instala só dependências de produção (backend não tem devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# a pasta data é montada como volume pelo docker-compose (persistência no host)
EXPOSE 8787

CMD ["node", "src/server.js"]
