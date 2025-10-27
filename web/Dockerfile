FROM node:22.21.0-alpine

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies for build
RUN npm ci

COPY . .

# Build the app
RUN npm run build

# Remove dev dependencies for production
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "build/index.js"]
