# Node 24 (current LTS) ships npm 11, which avoids the "npm error Exit handler
# never called!" crash/hang from npm 10.8.2 (bundled with the now-EOL node:20).
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
# --include=dev: the build needs devDependencies (tsc, vite, @types/*) even if
# NODE_ENV=production is set. npm ci is deterministic (installs from the lockfile).
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
