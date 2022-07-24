#!/bin/sh

# DOCKER_BUILDKIT=1
BUILDKIT_PROGRESS=plain \
docker-compose --env-file .env \
-p meet-up-dev-stack \
-f docker-compose.yml \
-f docker-compose.dev.yml \
up --build -d 
