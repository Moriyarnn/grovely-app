FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ curl su-exec

COPY package*.json ./
RUN npm ci --build-from-source

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]