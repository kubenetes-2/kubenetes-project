# /home/kevin/gb-deploy/src/backend/Dockerfile
FROM node:18-alpine
WORKDIR /backend
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production PORT=8000 \
    MONGO_URL=mongodb://gb_mongodb:27017/jobsdb
EXPOSE 8000
CMD ["node","app.js"]

