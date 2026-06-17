FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# --include=dev: the build needs devDependencies (tsc, vite, @types/*) even if
# NODE_ENV=production is set. npm ci (deterministic, from the lockfile) — not
# npm install, which can crash on build hosts.
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
