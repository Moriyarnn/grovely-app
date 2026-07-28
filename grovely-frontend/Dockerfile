FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Dev: Vite dev server with HMR (source mounted via volume at runtime)
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# UAT / Prod: build static files, serve with vite preview
FROM deps AS build
COPY . .
ARG BUILD_MODE=prod
ARG VITE_BACKEND_PORT=3000
ARG VITE_FEEDBACK_ENDPOINT=https://feedback.grovely.org/v1/feedback
ARG VITE_FEEDBACK_PUBLIC_KEY=BK0KbOInZhWuN5eJ50bqxkAdk9GEPSS5sjEPNZ8T0wLgvEb1RMOXs-0ABta0NHgXnsT5m9J9Oej3_e0-b7GpjcY
ARG VITE_FEEDBACK_PUBLIC_KEY_ID=v1
ENV VITE_BACKEND_PORT=${VITE_BACKEND_PORT}
ENV VITE_FEEDBACK_ENDPOINT=${VITE_FEEDBACK_ENDPOINT}
ENV VITE_FEEDBACK_PUBLIC_KEY=${VITE_FEEDBACK_PUBLIC_KEY}
ENV VITE_FEEDBACK_PUBLIC_KEY_ID=${VITE_FEEDBACK_PUBLIC_KEY_ID}
RUN npx vite build --mode ${BUILD_MODE}
EXPOSE 5173
CMD ["npm", "run", "serve"]
