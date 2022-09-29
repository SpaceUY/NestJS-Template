FROM node:lts-alpine
# RUN as root
RUN apk add dumb-init
# Use the node user from the image (instead of the root user)
USER node
# Create app directory
WORKDIR /home/node

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running npm install on every code change.
COPY --chown=node:node package*.json ./
# Install app dependencies using the `npm ci` command instead of `npm install`
RUN npm ci
# Bundle app source
COPY --chown=node:node . .

# Run the build command which creates the production bundle
RUN npm run build

RUN chmod 777 ./docker-script.sh

# Start the server using the production build
CMD ./docker-script.sh
