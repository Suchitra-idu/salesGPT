#!/bin/bash

# Chatwoot Setup Script for Raspberry Pi
# This script helps you set up Chatwoot with your salesGPT integration

echo "=== Chatwoot Setup Script ==="
echo "This script will help you set up Chatwoot on your Raspberry Pi"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp chatwoot.env .env
    echo "✅ .env file created"
else
    echo "⚠️  .env file already exists"
fi

# Generate secret key if not already set
if grep -q "your_secret_key_here_change_this_in_production" .env; then
    echo ""
    echo "Generating new secret key..."
    SECRET_KEY=$(openssl rand -hex 64)
    sed -i "s/your_secret_key_here_change_this_in_production/$SECRET_KEY/" .env
    echo "✅ Secret key generated and updated in .env"
else
    echo "✅ Secret key already configured"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Review and edit .env file if needed"
echo "2. Run: docker-compose -f chatwoot-docker-compose.yml up -d"
echo "3. Access Chatwoot at: http://192.168.1.103:9090"
echo ""
echo "Default admin credentials will be created on first run."
echo "Check the logs with: docker-compose -f chatwoot-docker-compose.yml logs -f"

# Get Raspberry Pi IP address
PI_IP=$(hostname -I | awk '{print $1}')
echo "📱 Detected Raspberry Pi IP: $PI_IP"

# Create environment file
cat > chatwoot.env << EOF
# Chatwoot Environment Configuration
# Generated on $(date)

# Database
DATABASE_URL=postgresql://chatwoot:chatwoot_password@postgres:5432/chatwoot
REDIS_URL=redis://redis:6379

# Application
SECRET_KEY_BASE=$SECRET_KEY
FRONTEND_URL=http://$PI_IP:3000

# Webhook for salesGPT integration
WEBHOOK_URL=http://$PI_IP:3001/api/chatwoot/webhook

# File Storage
STORAGE_PROVIDER=local

# Email (optional - configure if needed)
SMTP_ADDRESS=
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_DOMAIN=
SMTP_PORT=587
SMTP_AUTHENTICATION=plain
SMTP_ENABLE_STARTTLS_AUTO=true

# Application Settings
INSTALLATION_NAME="My Chatwoot Instance"
DEFAULT_LOCALE=en
RAILS_ENV=production
NODE_ENV=production
EOF

echo "✅ Environment file created: chatwoot.env"
echo ""

# Update docker-compose file with correct IP
sed -i "s/your_raspberry_pi_ip/$PI_IP/g" chatwoot-docker-compose.yml

echo "✅ Docker Compose file updated with your IP address"
echo ""

echo "📋 Port Usage Summary:"
echo "   - Chatwoot Web Interface: http://$PI_IP:3000"
echo "   - PostgreSQL Database: $PI_IP:5433"
echo "   - Redis Cache: $PI_IP:6380"
echo "   - Your salesGPT API: $PI_IP:3001"
echo ""

echo "🔍 Port Conflict Check:"
echo "Checking for potential port conflicts..."

# Check if ports are in use
if netstat -tuln | grep -q ":3000 "; then
    echo "⚠️  WARNING: Port 3000 is already in use!"
else
    echo "✅ Port 3000 is available"
fi

if netstat -tuln | grep -q ":5433 "; then
    echo "⚠️  WARNING: Port 5433 is already in use!"
else
    echo "✅ Port 5433 is available"
fi

if netstat -tuln | grep -q ":6380 "; then
    echo "⚠️  WARNING: Port 6380 is already in use!"
else
    echo "✅ Port 6380 is available"
fi

echo ""
echo "🚀 Next Steps:"
echo "1. Review the configuration files"
echo "2. Run: docker-compose -f chatwoot-docker-compose.yml up -d"
echo "3. Wait for Chatwoot to start (may take a few minutes)"
echo "4. Access Chatwoot at: http://$PI_IP:3000"
echo "5. Create your first account and inbox"
echo "6. Configure webhook URL in Chatwoot settings"
echo ""

echo "📚 Integration Notes:"
echo "- Chatwoot webhook URL: http://$PI_IP:3001/api/chatwoot/webhook"
echo "- Your salesGPT API: http://$PI_IP:3001/api/chatwoot/chat"
echo "- Status endpoint: http://$PI_IP:3001/api/chatwoot/status"
echo ""

echo "🎯 To start Chatwoot:"
echo "docker-compose -f chatwoot-docker-compose.yml up -d"
echo ""
echo "🎯 To stop Chatwoot:"
echo "docker-compose -f chatwoot-docker-compose.yml down"
echo ""
echo "🎯 To view logs:"
echo "docker-compose -f chatwoot-docker-compose.yml logs -f" 