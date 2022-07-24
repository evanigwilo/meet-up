#!/bin/sh

docker-compose --env-file .env \
-p meet-up-dev-stack \
-f docker-compose.yml \
-f docker-compose.dev.yml \
down -v --remove-orphans
