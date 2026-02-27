# Navidrome Jukebox Web Player

A modern, beautiful web interface for controlling [Navidrome](https://www.navidrome.org/)'s Jukebox mode. Control music playback on your server from any device with a sleek, responsive UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-5.2-646cff.svg)

## 🎵 Features

- **🎛️ Full Jukebox Control** - Play, pause, skip, shuffle, and manage your music queue
- **🔍 Real-time Search** - Search your entire music library and add songs instantly
- ~~**🎨 Modern UI** - Beautiful glassmorphic design with smooth animations~~ Old classic Winamp style 😜
- **📱 Responsive** - Works seamlessly on desktop, tablet, and mobile devices
- **🎚️ Volume Control** - Adjust playback volume remotely
- **🔁 Repeat Modes** - Repeat off, repeat all, or repeat one track
- **🎲 Random Song** - Add random songs to your queue with one click
- **⏱️ Live Progress** - Real-time playback position and duration tracking
- **🖼️ Album Art** - High-quality cover art display
- **🔒 HTTPS Support** - Secure connection with Let's Encrypt certificates
- **🐳 Docker Ready** - Easy deployment with Docker Compose

## 📋 Prerequisites

- **Navidrome** server with Jukebox mode enabled
- **Docker** and **Docker Compose** (for deployment)
- **Node.js** 18+ (for development)
- **MPV** player installed on the server (for audio playback)
- **ALSA** audio system configured
- **Let's Encrypt** SSL certificates (optional, for HTTPS)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/bgpntx/kneep.git
cd kneep
```

### 2. Configure Your Environment

#### Update Docker Compose Volumes

Edit `docker-compose.yml` to match your setup:

```yaml
volumes:
  - /big/Muz:/music:ro              # Your music library (read-only)
  - /nvme1/navidrome:/data          # Navidrome data directory
  - ./navidrome.toml:/data/navidrome.toml:ro
```

#### Configure SSL Certificates (if using HTTPS)

Update paths in `docker-compose.yml`:

```yaml
volumes:
  - /etc/letsencrypt/archive/nest.vps.pw/fullchain3.pem:/etc/nginx/ssl/fullchain.pem:ro
  - /etc/letsencrypt/archive/nest.vps.pw/privkey3.pem:/etc/nginx/ssl/privkey.pem:ro
```

#### Update Audio Device

Verify your audio device name:

```bash
aplay -L
```

Update `docker-compose.yml` if needed:

```yaml
environment:
  ND_MPV_CMD_TEMPLATE: "mpv --no-video --audio-device='alsa/sysdefault:CARD=U24XL' ${INPUT}"
```

And in `navidrome.toml`:

```toml
Jukebox.Devices = [
  ["U24XL", "alsa/sysdefault:CARD=U24XL"]
]
Jukebox.Default = "U24XL"
```

### 3. Configure Navidrome

Review and adjust `navidrome.toml` settings:

```toml
# Base Configuration
MusicFolder = "/music"
DataFolder = "/data"
LogLevel = "DEBUG"
SessionTimeout = "48h"

# Jukebox Configuration
Jukebox.Enabled = true
Jukebox.AdminOnly = false
Jukebox.Devices = [
  ["U24XL", "alsa/sysdefault:CARD=U24XL"]
]
Jukebox.Default = "U24XL"

# MPV Configuration
MPVPath = "/usr/bin/mpv"
MPVCmdTemplate = "mpv --no-video --audio-device=%d --input-ipc-server=%s %f"

# Library Scanner
Scanner.Schedule = "@every 24h"

# Cache Settings
ImageCacheSize = "100MiB"
TranscodingCacheSize = "100MiB"

# Last.fm Integration (optional)
[LastFM]
Enabled = true
ApiKey = "your-api-key"
Secret = "your-secret"
Language = "en"
```

### 4. Build and Deploy

```bash
# Build the frontend
npm install
npm run build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 5. Access the Web Player

The application is accessible on multiple ports:

- **HTTP**: `http://your-server:8080`
- **HTTPS**: `https://your-server:8443`
- **Navidrome HTTPS**: `https://your-server:4533`

For this setup with domain `nest.vps.pw`:
- `https://nest.vps.pw:8443` - Web interface
- `https://nest.vps.pw:4533` - Navidrome API

## ⚙️ Configuration

### System Requirements

- **User/Group**: Container runs as UID 1000, GID 1000
- **Audio Group**: GID 29 for ALSA device access
- **Timezone**: Europe/Kyiv (configurable in docker-compose.yml)
- **Device Access**: `/dev/snd` must be accessible

### First-Time Setup

1. Open the web player at `http://your-server:8080`
2. Scroll to the configuration section at the bottom
3. Enter your credentials:
   - **Server URL**: `http://your-server:4533` (or `https://nest.vps.pw:4533`)
   - **Username**: Your Navidrome username
   - **Token** & **Salt**: Get these from Navidrome's web interface
4. Click **Save & Connect**

### Getting Token and Salt

1. Log into Navidrome's web interface
2. Open browser DevTools (F12) → Network tab
3. Play any song or make any API request
4. Look at the request URL and copy the `t=` and `s=` values
5. Paste these into the Token and Salt fields

**Note**: Token/salt credentials are valid for 48 hours (configurable via `SessionTimeout`).

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│   Docker Compose Stack                              │
│                                                     │
│  ┌─────────────────────────────────────────────────┤
│  │  Nginx Web Server                               │
│  │  - Port 8080 (HTTP)                            │
│  │  - Port 8443 (HTTPS)                           │
│  │  - Port 4533 (Navidrome HTTPS Proxy)          │
│  │  - Serves React Frontend from ./dist           │
│  │  - SSL: Let's Encrypt (nest.vps.pw)           │
│  └──────────────┬──────────────────────────────────┤
│                 │                                    │
│  ┌──────────────▼──────────────────────────────────┤
│  │  Navidrome Service                              │
│  │  - Container: navidrome                         │
│  │  - Image: navidrome-mpv (custom build)        │
│  │  - User: 1000:1000                             │
│  │  - Audio Group: 29                             │
│  │  - Internal Port: 4533                         │
│  │  - Jukebox API Enabled                         │
│  │  - Music: /big/Muz (read-only)                │
│  │  - Data: /nvme1/navidrome                      │
│  └──────────────┬──────────────────────────────────┤
│                 │                                    │
│  ┌──────────────▼──────────────────────────────────┤
│  │  MPV Player                                     │
│  │  - Audio Output: ALSA                          │
│  │  - Device: U24XL                               │
│  │  - Hardware: /dev/snd                          │
│  │  - No Video Output                             │
│  └─────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────┘
```

## 🐳 Docker Configuration Details

### Navidrome Service

```yaml
services:
  navidrome:
    build:
      context: .
      dockerfile: Dockerfile
    image: navidrome-mpv
    container_name: navidrome
    user: "1000:1000"
    environment:
      TZ: Europe/Kyiv
      ND_MUSICFOLDER: /music
      ND_DATAFOLDER: /data
      ND_LOGLEVEL: debug
      ND_JUKEBOX_ENABLED: "true"
      ND_JUKEBOX_ADMINONLY: "false"
      ND_MPV_CMD_TEMPLATE: "mpv --no-video --audio-device='alsa/sysdefault:CARD=U24XL' ${INPUT}"
    expose:
      - "4533"
    volumes:
      - /big/Muz:/music:ro
      - /nvme1/navidrome:/data
      - ./navidrome.toml:/data/navidrome.toml:ro
    devices:
      - /dev/snd:/dev/snd
    group_add:
      - "29"  # Audio group
    restart: unless-stopped
```

### Web/Nginx Service

```yaml
  web:
    image: nginx:alpine
    container_name: jukebox-web
    depends_on:
      - navidrome
    ports:
      - "8080:80"      # HTTP
      - "8443:8443"    # HTTPS
      - "4533:4533"    # Navidrome HTTPS proxy
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx.default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt/archive/nest.vps.pw/fullchain3.pem:/etc/nginx/ssl/fullchain.pem:ro
      - /etc/letsencrypt/archive/nest.vps.pw/privkey3.pem:/etc/nginx/ssl/privkey.pem:ro
    restart: unless-stopped
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Access at http://localhost:5173
```

### Building

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
kneep/
├── public/                  # Static assets (images, icons)
│   ├── play.png
│   └── winamp.jpg
├── src/
│   ├── api/
│   │   └── subsonic.js      # Navidrome/Subsonic API client
│   ├── components/
│   │   └── QueueItem.jsx    # Sortable queue item component
│   ├── utils/
│   │   ├── helpers.js       # Time formatting utilities
│   │   ├── md5.js           # MD5 hash for Subsonic auth
│   │   └── playbackManager.js # Playback state persistence
│   ├── App.jsx              # Main application component
│   ├── App.css              # Styles
│   └── main.jsx             # Entry point
├── docker-compose.yml       # Docker services configuration
├── Dockerfile               # Custom Navidrome image with MPV
├── Jenkinsfile              # CI/CD pipeline
├── nginx.default.conf       # Nginx proxy configuration
├── navidrome.toml           # Navidrome server configuration
├── rebuild.sh               # Production rebuild script
├── vite.config.js           # Vite build configuration
└── package.json             # Dependencies and scripts
```

## 🔧 Troubleshooting

### "Wrong username or password" Error

- Verify your token and salt are correct
- Check if the token has expired (regenerate from Navidrome)
- Ensure the server URL is correct and accessible
- Verify SessionTimeout in navidrome.toml (default: 48h)

### No Audio Playing

1. **Check MPV installation**:
   ```bash
   docker exec navidrome which mpv
   ```

2. **Verify audio device**:
   ```bash
   docker exec navidrome aplay -L
   ```

3. **Check audio group permissions**:
   ```bash
   ls -l /dev/snd/
   getent group 29  # Should show audio group
   ```

4. **View Navidrome logs**:
   ```bash
   docker-compose logs -f navidrome
   ```

5. **Test MPV directly**:
   ```bash
   docker exec navidrome mpv --audio-device=alsa/sysdefault:CARD=U24XL /music/test.mp3
   ```

### Docker Container Issues

```bash
# Check container status
docker-compose ps

# Restart services
docker-compose restart

# Rebuild with no cache
docker-compose build --no-cache
docker-compose up -d

# View all logs
docker-compose logs
```

### HTTPS/SSL Issues

- Verify certificate paths exist:
  ```bash
  ls -l /etc/letsencrypt/archive/nest.vps.pw/
  ```
- Check Nginx configuration:
  ```bash
  docker exec jukebox-web nginx -t
  ```
- Review Nginx logs:
  ```bash
  docker-compose logs web
  ```

### Firefox HTTPS-Only Mode

If using Firefox with local HTTP:
1. Click the 🔒 lock icon in the address bar
2. Select "Turn off HTTPS-Only Mode"
3. Reload the page

### Permission Denied on /dev/snd

```bash
# Add user to audio group on host
sudo usermod -aG audio $(whoami)

# Or adjust group_add in docker-compose.yml to match your system
getent group audio  # Check audio GID
```

### Music Library Not Scanning

1. Check volume mount permissions:
   ```bash
   docker exec navidrome ls -la /music
   ```

2. Trigger manual scan:
   - Log into Navidrome web UI
   - Go to Settings → Library
   - Click "Full Rescan"

3. Check scanner schedule in navidrome.toml:
   ```toml
   Scanner.Schedule = "@every 24h"
   ```

## 🎨 Features in Detail

### Queue Management
- Click track number to jump to that song
- Remove individual tracks with ✕ button
- Clear entire queue with Clear button
- View current playing track highlighted
- Shuffle queue order

### Search
- Real-time search as you type
- Search across title, artist, and album
- Click any result to add to queue
- Automatically starts playback if queue is empty

### Playback Controls
- **Play/Pause**: Toggle playback
- **Previous**: Go to previous track (or restart if >3s into song)
- **Next**: Skip to next track
- **Shuffle**: Randomize queue order
- **Repeat**: Off → All → One
- **Stop**: Stop playback and reset
- **Clear**: Remove all tracks from queue
- **Random**: Add a random song from your library

### Volume Control
- Smooth volume slider (0-100%)
- Real-time volume adjustment
- Persists between sessions via localStorage

## 🔐 Security Notes

- Credentials stored in browser's `localStorage`
- Token/salt authentication follows Subsonic API standard
- No password storage - only pre-generated tokens
- HTTPS supported via Let's Encrypt certificates
- Nginx reverse proxy for secure API access
- Read-only music volume mount

## 📝 Environment Variables

Configure via Docker Compose:

```yaml
environment:
  TZ: Europe/Kyiv                    # Timezone
  ND_MUSICFOLDER: /music             # Music library path
  ND_DATAFOLDER: /data               # Data directory
  ND_LOGLEVEL: debug                 # Log level (info, debug, trace)
  ND_JUKEBOX_ENABLED: "true"         # Enable jukebox mode
  ND_JUKEBOX_ADMINONLY: "false"      # Allow non-admin jukebox access
  ND_MPV_CMD_TEMPLATE: "..."         # MPV command template
```

## 📊 Monitoring & Logs

```bash
# Follow all logs
docker-compose logs -f

# Navidrome only
docker-compose logs -f navidrome

# Nginx only
docker-compose logs -f web

# Last 100 lines
docker-compose logs --tail=100

# Check resource usage
docker stats navidrome jukebox-web
```

## 🔄 Updates & Maintenance

### Update Navidrome

```bash
docker-compose pull
docker-compose up -d
```

### Update Frontend

```bash
npm install
npm run build
docker-compose restart web
```

### Backup Configuration

```bash
# Backup data directory
tar -czf navidrome-backup-$(date +%Y%m%d).tar.gz /nvme1/navidrome

# Backup configuration
cp navidrome.toml navidrome.toml.backup
cp docker-compose.yml docker-compose.yml.backup
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Navidrome](https://www.navidrome.org/) - The excellent music server
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [MPV](https://mpv.io/) - Media player
- [Nginx](https://nginx.org/) - Web server and reverse proxy

## 📧 Support

For issues and questions:
- Check the [Troubleshooting](#-troubleshooting) section
- Review [Navidrome documentation](https://www.navidrome.org/docs/)
- Check [MPV documentation](https://mpv.io/manual/stable/)
- Open an issue on GitHub

## 🌟 Related Projects

- [Navidrome](https://github.com/navidrome/navidrome) - Music Server and Streamer
- [Subsonic](http://www.subsonic.org/) - Original protocol specification

---

**Made with ❤️ for music lovers who want a better jukebox experience**

*Configured for nest.vps.pw with U24XL audio device*
