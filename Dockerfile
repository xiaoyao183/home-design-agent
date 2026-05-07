# 基于官方 Node 镜像，便于在任意容器平台获得固定「可分享 HTTPS 链接」
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server.mjs"]
