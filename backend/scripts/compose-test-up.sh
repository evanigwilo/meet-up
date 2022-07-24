#!/bin/sh

# run test and watch for changes
# access passed arguments with $1 to run a specific test
export TEST_ARGS="--watchAll $1"
# show container output
export BUILDKIT_PROGRESS="plain"

command="--env-file .env \
-p meet-up-test-stack \
-f docker-compose.yml \
-f docker-compose.dev.yml \
-f docker-compose.test.yml up"

# cleanup test containers before test
yarn compose-test-down && \
# start services
docker-compose $command --build -d && \
# attach server to shell
docker-compose $command api-server && \
# cleanup test containers after test
yarn compose-test-down


# docker-compose $command \
# -d redis mongo postgres \
# && \
# docker-compose $command \
# --abort-on-container-exit api-server 