#!/bin/sh

docker-compose --env-file .env \
-p meet-up-test-stack \
-f docker-compose.yml \
-f docker-compose.dev.yml \
-f docker-compose.test.yml \
down -v --remove-orphans