# HIMSHRAVAN containerized deployment

## 1. Prerequisites

- Docker Engine 24+ with Buildx
- Docker Compose v2 (recommended)
- Ubuntu 22.04 host with kubectl and a working Kubernetes cluster
- Optional: a container registry such as Docker Hub, GHCR, or Harbor

## 2. Install Docker Compose v2

On Ubuntu 22.04:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Verify:

```bash
docker compose version
```

## 3. Build and run locally with Docker Compose

From the repository root:

```bash
cd /home/dell/Documents/July_9/HIMSHRAVAN
docker compose up -d --build
```

Services:
- Frontend: http://localhost:3001
- Backend: http://localhost:8000
- PostgreSQL: localhost:5432

To inspect logs:

```bash
docker compose logs -f backend frontend db
```

To stop everything:

```bash
docker compose down
```

## 4. Build individual images

```bash
docker build -t himshravan-backend:latest ./device
docker build -t himshravan-frontend:latest ./next.config
docker build -t himshravan-db:latest ./k8s/postgres
```




## 5. Push images to a registry

Example with Docker Hub:

```bash
# log in first
# docker login

docker tag himshravan-backend:latest <your-registry>/himshravan-backend:latest
docker push <your-registry>/himshravan-backend:latest

docker tag himshravan-frontend:latest <your-registry>/himshravan-frontend:latest
docker push <your-registry>/himshravan-frontend:latest

docker tag himshravan-db:latest <your-registry>/himshravan-db:latest
docker push <your-registry>/himshravan-db:latest
```

## 6. Deploy to Kubernetes on Ubuntu 22.04

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/db.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

Check rollout status:

```bash
kubectl get pods -n himshravan
kubectl get svc -n himshravan
```

## 7. Recommended production hardening

- Use Kubernetes Secrets instead of plain env values.
- Configure an ingress controller and TLS certificate.
- Mount persistent storage for PostgreSQL and application logs.
- Use a private registry and image pull secrets.
- Set the frontend API base URL through an environment variable or ingress host.


<!-- start docker-UP -->

sudo docker compose up -d

<!-- build -->

sudo systemctl restart docker

<!-- install Backend -->

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt