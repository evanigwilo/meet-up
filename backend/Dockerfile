# Pull the Node.js Docker image
FROM node:16-alpine

# Set the working directory inside the container
WORKDIR /backend

# A wildcard is used to ensure both package.json and package-lock.json are copied
COPY package*.json ./
COPY yarn.lock ./

# From compose or build args
ARG NODE_ENV 
# Store arg as environment variable
ENV NODE_ENV ${NODE_ENV}

ARG INSTALL="--immutable --immutable-cache"
# Install packages only if 'package.json' or 'yarn.lock' changes
RUN if [ "$NODE_ENV" == "production" ]; \
    then yarn install --production --frozen-lockfile --check-cache $INSTALL; \
    else yarn install $INSTALL; \
    fi 

# Copy source files
COPY . ./
# Copy the sample environmental variables file
COPY .env.example ./.env
# Conditional copy to update the environmental variables file if it exist
COPY .env* ./

# Build only on production
RUN if [ "$NODE_ENV" == "production" ]; \
    then yarn build; \
    else echo skip build; \
    fi

# expose port for documentation purposes
EXPOSE 4000

CMD yarn "$(if [ "$NODE_ENV" == "development" ]; \
    then echo "dev-ts"; \
    elif [ "$NODE_ENV" == "testing" ]; \
    then echo "test"; \
    else echo "start"; \
    fi)"