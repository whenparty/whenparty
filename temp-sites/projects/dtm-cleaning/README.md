# DTM Cleaning Web - Temp Site

Example temporary site hosted at `dtm-cleaning.when.party`

## Stack

- **Web Server**: Nginx (Alpine)
- **Content**: Static HTML in `site/` directory
- **Routing**: Traefik via Docker labels

## Local Development

```bash
cd projects/dtm-cleaning

# Build a local image for iteration
docker build -t dtm-cleaning:dev .

# Run through compose (uses the IMAGE env var if provided)
IMAGE=dtm-cleaning:dev docker compose up -d

# Follow logs
docker compose logs -f

# Stop and remove resources
docker compose down -v
```

## Deployment

Automatically deployed via GitHub Actions when changes are pushed to `projects/dtm-cleaning/`

## Accessing the Site

- Production: https://dtm-cleaning.when.party
- Local (via Traefik): Configure local DNS or hosts file to point to localhost

## File Structure

```
dtm-cleaning/
├── Dockerfile       # Builds the GHCR image
├── compose.yml      # Service definition + Traefik labels
├── site/            # Static website files
│   └── index.html
└── README.md        # This file
```
