FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js ./
COPY src ./src

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
USER node
EXPOSE 5003
CMD ["node", "index.js"]
