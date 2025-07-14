# Chatwoot Setup for Raspberry Pi

This guide helps you install Chatwoot on your Raspberry Pi using Portainer, avoiding port conflicts with existing services like Pi-hole, Portainer, RPI Monitor, and Glance.

## 🚀 Quick Start

### 1. Download Files
```bash
# Download the setup files to your Raspberry Pi
wget https://raw.githubusercontent.com/your-repo/chatwoot-docker-compose.yml
wget https://raw.githubusercontent.com/your-repo/setup-chatwoot.sh
chmod +x setup-chatwoot.sh
```

### 2. Run Setup Script
```bash
./setup-chatwoot.sh
```

### 3. Deploy with Portainer
1. Open Portainer in your browser
2. Go to **Stacks** → **Add Stack**
3. Upload the `chatwoot-docker-compose.yml` file
4. Click **Deploy the stack**

## 📋 Port Configuration

| Service | Port | Purpose | Conflict Avoidance |
|---------|------|---------|-------------------|
| Chatwoot Web | 3000 | Web interface | Standard Chatwoot port |
| PostgreSQL | 5433 | Database | Avoids default 5432 |
| Redis | 6380 | Cache | Avoids default 6379 |
| Your salesGPT | 3001 | API | Different from Chatwoot |

## 🔧 Configuration

### Environment Variables
The setup script creates `chatwoot.env` with:
- **Database**: PostgreSQL with persistent storage
- **Cache**: Redis with persistence
- **Webhook**: Points to your salesGPT API
- **Security**: Auto-generated secret key

### Customization
Edit `chatwoot.env` to configure:
- Email settings (SMTP)
- File storage
- Installation name
- Locale settings

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chatwoot      │    │   PostgreSQL    │    │     Redis       │
│   (Port 3000)   │◄──►│   (Port 5433)   │    │   (Port 6380)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  salesGPT API   │
│  (Port 3001)    │
└─────────────────┘
```

## 🔗 Integration with salesGPT

### Webhook Configuration
1. In Chatwoot, go to **Settings** → **Integrations**
2. Add webhook URL: `http://your-pi-ip:3001/api/chatwoot/webhook`
3. Select events: `message_created`

### API Endpoints
- **Chat Processing**: `POST /api/chatwoot/chat`
- **Webhook Handler**: `POST /api/chatwoot/webhook`
- **Status Check**: `GET /api/chatwoot/status`
- **Manual Handoff**: `POST /api/chatwoot/handoff`

## 🛠️ Management Commands

### Using Portainer
- **Start/Stop**: Use Portainer interface
- **Logs**: View container logs in Portainer
- **Updates**: Pull new images and restart

### Using Command Line
```bash
# Start services
docker-compose -f chatwoot-docker-compose.yml up -d

# Stop services
docker-compose -f chatwoot-docker-compose.yml down

# View logs
docker-compose -f chatwoot-docker-compose.yml logs -f

# Update to latest version
docker-compose -f chatwoot-docker-compose.yml pull
docker-compose -f chatwoot-docker-compose.yml up -d
```

## 🔍 Troubleshooting

### Common Issues

**1. Port Conflicts**
```bash
# Check what's using the ports
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :5433
sudo netstat -tulpn | grep :6380
```

**2. Database Connection Issues**
```bash
# Check PostgreSQL logs
docker logs chatwoot_postgres

# Check Chatwoot logs
docker logs chatwoot_app
```

**3. Webhook Not Working**
- Verify webhook URL in Chatwoot settings
- Check salesGPT API is running on port 3001
- Review webhook logs in salesGPT

### Log Locations
- **Chatwoot**: `docker logs chatwoot_app`
- **Database**: `docker logs chatwoot_postgres`
- **Redis**: `docker logs chatwoot_redis`
- **Sidekiq**: `docker logs chatwoot_sidekiq`

## 📊 Monitoring

### Resource Usage
Monitor these containers in Portainer:
- `chatwoot_app` - Main application
- `chatwoot_postgres` - Database
- `chatwoot_redis` - Cache
- `chatwoot_sidekiq` - Background jobs

### Health Checks
- Chatwoot web interface: `http://your-pi-ip:3000`
- Database: `docker exec chatwoot_postgres pg_isready`
- Redis: `docker exec chatwoot_redis redis-cli ping`

## 🔒 Security Notes

1. **Change default passwords** in production
2. **Use HTTPS** in production (add reverse proxy)
3. **Regular backups** of PostgreSQL data
4. **Keep containers updated**
5. **Monitor logs** for suspicious activity

## 📈 Performance Tips

1. **SSD Storage**: Use SSD for better database performance
2. **Memory**: Ensure at least 2GB RAM available
3. **CPU**: Monitor CPU usage during peak times
4. **Network**: Stable network connection for webhooks

## 🆘 Support

- **Chatwoot Documentation**: https://www.chatwoot.com/docs
- **Docker Documentation**: https://docs.docker.com/
- **Portainer Documentation**: https://docs.portainer.io/

## 📝 Notes

- First startup may take 5-10 minutes
- Database migrations run automatically
- Default admin account created on first run
- All data persisted in Docker volumes
- No nginx required (direct port access) 