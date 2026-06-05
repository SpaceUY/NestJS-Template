FROM node:lts-alpine
# RUN as root
RUN apk add dumb-init
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
RUN pnpm exec prisma generate

RUN pnpm run build

RUN chmod 777 ./docker-script.sh

# Start the server using the production build
CMD ./docker-script.sh
