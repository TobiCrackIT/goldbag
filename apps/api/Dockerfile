# Build from the repo root so workspace packages resolve:
#   docker build -f apps/api/Dockerfile -t goldbag-api .
# One image, two commands (architecture §2):
#   api:    docker run goldbag-api
#   worker: docker run goldbag-api node apps/api/dist/worker.js
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.5.2
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@goldbag/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
