FROM node:20-alpine

WORKDIR /app

# node:20-alpine ships npm 10.8.2, which crashes with "npm error Exit handler
# never called!" during `npm ci` on these build hosts (a known npm 10.8.x bug
# that left the install incomplete and broke `tsc`). Upgrade to npm 11 first so
# the install actually completes.
RUN npm install -g npm@11

# Copy manifests first so this layer is cached unless dependencies change.
COPY package*.json ./

# Install ALL dependencies, including devDependencies, so the TypeScript build
# (`tsc`) can run. --include=dev forces devDependencies even when the build
# environment sets NODE_ENV=production (Render injects it) — without this the
# build fails with "sh: tsc: not found" (exit 127). `npm ci` is deterministic.
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

# The compiled output is in dist/; drop devDependencies from the final image.
RUN npm prune --omit=dev

EXPOSE 4000
CMD ["node", "dist/index.js"]
