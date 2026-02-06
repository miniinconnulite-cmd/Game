FROM node:18-alpine

WORKDIR /app

# Dépendances système obligatoires
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  libc6-compat \
  git \
  ffmpeg \
  bash

# Copier les dépendances
COPY package*.json ./

# Installer npm deps
RUN npm install --omit=dev

# Copier le reste du projet
COPY . .

# Exposer le port si express
EXPOSE 3000

# Lancer le bot (PAS pm2)
CMD ["node", "index.js"]
