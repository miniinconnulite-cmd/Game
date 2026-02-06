# Utiliser Node.js 20 au lieu de 18
FROM node:20-alpine

WORKDIR /app

# Dépendances système obligatoires
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  libc6-compat \
  git \
  ffmpeg \
  bash \
  # Ajouts recommandés pour certaines dépendances
  build-base \
  cairo-dev \
  pango-dev \
  giflib-dev \
  librsvg-dev

# Copier les dépendances
COPY package*.json ./

# Installer npm deps (avec --legacy-peer-deps si nécessaire)
RUN npm install --omit=dev --legacy-peer-deps

# Copier le reste du projet
COPY . .

# Nettoyer le cache npm pour réduire la taille de l'image
RUN npm cache clean --force

# Exposer le port si express
EXPOSE 3000

# Lancer le bot (PAS pm2 dans Docker)
CMD ["node", "index.js"]
