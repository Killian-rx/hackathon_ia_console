FROM python:3.12-slim

WORKDIR /app
COPY chat-console.html server.py ./

ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080

# Optionnel : proxifier le backend d'inférence pour éviter le CORS.
#   docker run -e UPSTREAM=http://host.docker.internal:11434 ...
ENTRYPOINT ["python3", "server.py"]
