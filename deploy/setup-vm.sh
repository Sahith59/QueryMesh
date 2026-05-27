#!/bin/bash
# QueryMesh VM setup script
# Run once on a fresh Ubuntu 22.04 OCI ARM instance
# Usage: bash setup-vm.sh <your-duckdns-subdomain> <your-duckdns-token>
# Example: bash setup-vm.sh querymesh abc123-def456-...

set -e

DOMAIN="${1}.duckdns.org"
DUCK_DOMAIN="$1"
DUCK_TOKEN="$2"

if [[ -z "$DOMAIN" || -z "$DUCK_TOKEN" ]]; then
  echo "Usage: bash setup-vm.sh <subdomain> <duckdns-token>"
  exit 1
fi

echo "==> Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  nginx certbot python3-certbot-nginx git

echo "==> Installing Docker..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"

echo "==> Cloning QueryMesh..."
cd /opt
sudo git clone https://github.com/Sahith59/QueryMesh.git querymesh
sudo chown -R "$USER:$USER" /opt/querymesh

echo "==> Building and starting containers (this takes ~5 minutes)..."
cd /opt/querymesh
docker compose -f docker-compose.prod.yml up --build -d

echo "==> Waiting for containers to be healthy..."
sleep 30

echo "==> Setting up Duck DNS updater..."
sudo tee /opt/duckdns-update.sh > /dev/null <<EOF
#!/bin/bash
curl -s "https://www.duckdns.org/update?domains=${DUCK_DOMAIN}&token=${DUCK_TOKEN}&ip=" \
     -o /var/log/duckdns.log
EOF
sudo chmod +x /opt/duckdns-update.sh
sudo /opt/duckdns-update.sh

# Run Duck DNS update every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/duckdns-update.sh") | crontab -

echo "==> Configuring nginx (HTTP only first, for cert issuance)..."
sudo tee /etc/nginx/sites-available/querymesh > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

sudo mkdir -p /var/www/certbot
sudo ln -sf /etc/nginx/sites-available/querymesh /etc/nginx/sites-enabled/querymesh
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "sahith0904@gmail.com" --redirect

echo "==> Setting up certbot auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | crontab -

echo ""
echo "============================================"
echo " QueryMesh is live at: https://${DOMAIN}"
echo "============================================"
echo ""
echo "Useful commands:"
echo "  docker compose -f /opt/querymesh/docker-compose.prod.yml ps"
echo "  docker compose -f /opt/querymesh/docker-compose.prod.yml logs -f"
echo "  sudo systemctl status nginx"
