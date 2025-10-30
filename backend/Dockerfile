# /home/kevin/gb-deploy/src/backend/Dockerfile
FROM node:18-alpine
WORKDIR /backend

# Install Python and build dependencies for node-gyp
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy the rest of the application
COPY . .

# Environment variables
ENV NODE_ENV=production \
    PORT=8000 \
    MONGO_URI=mongodb://mongodb:27017/jobsdb \
    JWT_SECRET=your_jwt_secret_key

EXPOSE 8000

CMD ["node", "app.js"]

