#!/bin/sh

docker-compose --env-file .env \
-p meet-up-prod-stack \
-f docker-compose.yml \
-f docker-compose.prod.yml \
down -v --remove-orphans
