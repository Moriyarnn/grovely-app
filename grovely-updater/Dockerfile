FROM node:24.18.0-alpine

RUN apk add --no-cache docker-cli docker-cli-compose
WORKDIR /app
COPY index.js compose.js ./
EXPOSE 3003
CMD ["node", "index.js"]
