mkdir results > /dev/null 2>&1
mozart render templates/docker-compose.yml -o results/docker-compose.yml
mozart labels-to-compose results/docker-compose.yml -o results/docker-compose.yml
docker compose --project-directory results/ up --build