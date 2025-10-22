# Navidrome Jukebox Web Player

A modern, beautiful web interface for controlling [Navidrome](https://www.navidrome.org/)'s Jukebox mode. Control music playback on your server from any device with a sleek, responsive UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-5.2-646cff.svg)

## 🎵 Features

- **🎛️ Full Jukebox Control** - Play, pause, skip, shuffle, and manage your music queue
- **🔍 Real-time Search** - Search your entire music library and add songs instantly
- **🎨 Modern UI** - Beautiful glassmorphic design with smooth animations
- **📱 Responsive** - Works seamlessly on desktop, tablet, and mobile devices
- **🎚️ Volume Control** - Adjust playback volume remotely
- **🔁 Repeat Modes** - Repeat off, repeat all, or repeat one track
- **🎲 Random Song** - Add random songs to your queue with one click
- **⏱️ Live Progress** - Real-time playback position and duration tracking
- **🖼️ Album Art** - High-quality cover art display
- **🐳 Docker Ready** - Easy deployment with Docker Compose

## 📋 Prerequisites

- **Navidrome** server with Jukebox mode enabled
- **Docker** and **Docker Compose** (for deployment)
- **Node.js** 18+ (for development)
- **MPV** player installed on the server (for audio playback)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/bgpntx/kneep.git
cd kneep
```

### 2. Configure Navidrome

Ensure your `navidrome.toml` has Jukebox enabled:

```toml
# Jukebox Configuration
Jukebox.Enabled = true
Jukebox.AdminOnly = false

# Audio Devices
Jukebox.Devices = [
  ["U24XL", "alsa/sysdefault:CARD=U24XL"]
]
Jukebox.Default = "U24XL"

# MPV Configuration
MPVPath = "/usr/bin/mpv"
MPVCmdTemplate = "mpv --no-video --audio-device=%d --input-ipc-server=%s %f"

# Session Settings
SessionTimeout = "48h"
```

### 3. Deploy with Docker Compose

```bash
# Build the frontend
npm install
npm run build

# Start services
docker-compose up -d
```

### 4. Access the Web Player

Open your browser and navigate to:
```
http://localhost:8080
```

## ⚙️ Configuration

### First-Time Setup

1. Open the web player
2. Scroll to the configuration section at the bottom
3. Enter your credentials:
   - **Server URL**: `http://your-server:4533`
   - **Username**: Your Navidrome username
   - **Token** & **Salt**: Get these from Navidrome's web interface
4. Click **Save & Connect**

### Getting Token and Salt

1. Log into Navidrome's web interface
2. Open browser DevTools (F12) → Network tab
3. Play any song or make any API request
4. Look at the request URL and copy the `t=` and `s=` values
5. Paste these into the Token and Salt fields

**Note**: Token/salt credentials are valid for the duration specified in `SessionTimeout` (default 48 hours).

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Docker Compose Stack              │
│                                     │
│  ┌────────────────────────────────┐│
│  │  Nginx (Port 8080)             ││
│  │  Serves: React Frontend        ││
│  └────────────┬───────────────────┘│
│               │                     │
│  ┌────────────▼───────────────────┐│
│  │  Navidrome (Port 4533)         ││
│  │  - Jukebox API                 ││
│  │  - Music Library               ││
│  │  - MPV Integration             ││
│  └────────────┬───────────────────┘│
│               │                     │
│  ┌────────────▼───────────────────┐│
│  │  MPV Player                    ││
│  │  - Audio Output via ALSA       ││
│  │  - Plays on Server Hardware    ││
│  └────────────────────────────────┘│
└─────────────────────────────────────┘
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
navidrome-jukebox-web/
├── src/
│   ├── App.jsx              # Main application component
│   ├── App.css              # Styles
│   ├── jukeboxApi.js        # Navidrome API client
│   └── main.jsx             # Entry point
├── dist/                    # Production build output
├── docker-compose.yml       # Docker services configuration
├── nginx.default.conf       # Nginx configuration
└── package.json             # Dependencies and scripts
```

## 🔧 Troubleshooting

### "Wrong username or password" Error

- Verify your token and salt are correct
- Check if the token has expired (regenerate from Navidrome)
- Ensure the server URL is correct and accessible

### No Audio Playing

- Check MPV is installed on the server: `which mpv`
- Verify audio device configuration in `navidrome.toml`
- Check Navidrome logs: `docker-compose logs navidrome`
- Ensure ALSA/audio group permissions are correct

### Firefox HTTPS-Only Mode Issues

If using Firefox, you may need to disable HTTPS-Only Mode:
1. Click the 🔒 lock icon in the address bar
2. Select "Turn off HTTPS-Only Mode"
3. Reload the page

### Connection Refused

- Verify Navidrome is running: `docker-compose ps`
- Check firewall rules allow port 4533
- Ensure `serverUrl` in config matches your setup

## 🎨 Features in Detail

### Queue Management
- Drag and drop to reorder (coming soon)
- Click track number to jump to that song
- Remove individual tracks
- Clear entire queue
- View current playing track highlighted

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
- Smooth volume slider
- Real-time volume adjustment
- Persists between sessions

## 🔐 Security Notes

- Credentials are stored in browser's `localStorage`
- Token/salt authentication follows Subsonic API standard
- No password storage - only pre-generated tokens
- HTTPS recommended for production use

## 📝 Environment Variables

Configure via Docker Compose environment:

```yaml
environment:
  ND_MUSICFOLDER: /music
  ND_DATAFOLDER: /data
  ND_LOGLEVEL: info
  ND_JUKEBOX_ENABLED: "true"
  ND_JUKEBOX_ADMINONLY: "false"
  ND_MPV_CMD_TEMPLATE: "mpv --no-video --audio-device='alsa/sysdefault:CARD=U24XL' ${INPUT}"
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

## 📧 Support

For issues and questions:
- Check the [Troubleshooting](#-troubleshooting) section
- Review [Navidrome documentation](https://www.navidrome.org/docs/)
- Open an issue on GitHub

---

**Made with ❤️ for music lovers who want a better jukebox experience**
