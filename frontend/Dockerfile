FROM node:20-alpine AS build
WORKDIR /app
# node:20-alpine ships npm 10.8.2, which crashes with "npm error Exit handler
# never called!" during `npm ci` (a known npm 10.8.x bug). Upgrade to npm 11
# first so the install completes.
RUN npm install -g npm@11
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
