# Inspetor Virtual — PWA (build Vite + nginx)

# --- stage 1: build ---
FROM node:22-alpine AS build
WORKDIR /app
ENV HTTPS=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- stage 2: serve estático + proxy /api ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
