# Two images from one file: nginx serving the built bundle, and the node sync
# server behind it. Build with `--target web` or `--target sync`; compose does
# both.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

# The server runs the TypeScript directly — Node strips the types, so there is
# no build step and no chance of the rules it enforces drifting from the source.
FROM node:24-alpine AS sync
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY src ./src
EXPOSE 8081
USER node
CMD ["node", "server/index.ts"]
