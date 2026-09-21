FROM node:24.15.0
# RUN as root. node:24.15.0 is Debian-based, so this is apt, not apk.
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
# Use the node user from the image (instead of the root user)
USER node
# Create app directory
WORKDIR /home/node

# Copy application dependency manifests to the container image.
# Copying this first prevents re-running pnpm install on every code change.
COPY --chown=node:node package.json pnpm-lock.yaml ./
# Install app dependencies using frozen lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Bundle app source
COPY --chown=node:node . .

# Run the build command which creates the production bundle
RUN pnpm run build

RUN chmod 755 ./docker-script.sh

# Liveness, not readiness: this decides whether to RESTART the container, and
# restarting because Postgres blinked turns one outage into two. Readiness
# (/health, dependencies included) is what the load balancer polls instead.
# Uses node's global fetch rather than curl, so the probe adds no package.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start the server using the production build
CMD ./docker-script.sh
