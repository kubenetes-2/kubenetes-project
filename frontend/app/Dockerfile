FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy app sources
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]



