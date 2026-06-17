FROM node:20-alpine

WORKDIR /app

# Copy manifests first so this layer is cached unless dependencies change.
COPY package*.json ./

# Install ALL dependencies, including devDependencies, so the TypeScript build
# (`tsc`) can run. --include=dev forces devDependencies even when the build
# environment sets NODE_ENV=production (Render injects it) — without this the
# build fails with "sh: tsc: not found" (exit 127). `npm ci` is deterministic and
# far more reliable than `npm install`, which crashes ("Exit handler never
# called!") on small build hosts.
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

# The compiled output is in dist/; drop devDependencies from the final image.
RUN npm prune --omit=dev

EXPOSE 4000
CMD ["node", "dist/index.js"]
