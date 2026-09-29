FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ARG VITE_LEGAL_BASE_URL
ARG VITE_MAX_BOT_USERNAME
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LEGAL_BASE_URL=$VITE_LEGAL_BASE_URL
ENV VITE_MAX_BOT_USERNAME=$VITE_MAX_BOT_USERNAME
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
