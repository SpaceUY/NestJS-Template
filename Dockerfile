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

# Start the server using the production build
CMD ./docker-script.sh
