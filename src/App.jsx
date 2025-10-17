// src/App.jsx - Simplified Authentication
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    callJukebox, 
    coverArtUrl, 
    addRandomSong, 
    searchSongs,
    getConfig,
    authenticate,
    reconnect,
    isSessionValid,
    escapeHtml 
} from './jukeboxApi';
import './App.css'; 

// --- UTILITY FUNCTIONS ---
function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// --- INITIAL STATE ---
const initialState = {
    playlist: [],
    currentIndex: 0,
    playing: false,
    gain: 1,
    position: 0,
    lastStatusTs: 0,
    localTickStart: 0,
    repeatMode: 'off',
    seeking: false,
    endHandledForId: null,
};

// Component for a single queue item
function JukeboxQueueItem({ song, index, currentIndex, onAction }) {
    const isCurrent = index === currentIndex;
    
    return (
        <div 
            className={`qitem${isCurrent ? ' current' : ''}`}
            data-index={index}
        >
            <div className="idx">{index + 1}</div>
            <div>
                <div className="qi-title">{escapeHtml(song.title || 'Unknown')}</div>
                <div className="qi-meta">{escapeHtml(song.artist || 'Unknown')}</div>
            </div>
            <div className="qi-actions">
                <button title="Play here" className="btn" onClick={() => onAction('play', index)}>▶️</button>
                <button title="Remove" className="btn" onClick={() => onAction('remove', index)}>✖️</button>
            </div>
        </div>
    );
}

export default function App() {
    const [state, setState] = useState(initialState);
    const [statusText, setStatusText] = useState('Initializing...');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [configForm, setConfigForm] = useState({
        serverUrl: '',
        username: '',
        password: ''
    });
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const commandInProgress = useRef(false);
    const stateRef = useRef(state);
    
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // --- Media Session API Integration ---
    const updateMediaSession = useCallback((track, position, playing) => {
        if ('mediaSession' in navigator && track) {
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.title || 'Unknown',
                    artist: track.artist || 'Unknown',
                    album: track.album || '',
                    artwork: [
                        { src: coverArtUrl(track.coverArt, 96), sizes: '96x96', type: 'image/jpeg' },
                        { src: coverArtUrl(track.coverArt, 128), sizes: '128x128', type: 'image/jpeg' },
                        { src: coverArtUrl(track.coverArt, 256), sizes: '256x256', type: 'image/jpeg' },
                        { src: coverArtUrl(track.coverArt, 512), sizes: '512x512', type: 'image/jpeg' },
                    ]
                });

                navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';

                try {
                    if ('setPositionState' in navigator.mediaSession) {
                        const duration = parseFloat(track.duration);
                        const pos = parseFloat(position);
                        
                        if (!isNaN(duration) && !isNaN(pos) && duration > 0) {
                            const validDuration = Math.max(0, duration);
                            const validPosition = Math.max(0, Math.min(pos, validDuration));
                            const validRate = playing ? 1.0 : 0.0;
                            
                            navigator.mediaSession.setPositionState({
                                duration: validDuration,
                                playbackRate: validRate,
                                position: validPosition
                            });
                        }
                    }
                } catch (posError) {
                    console.warn('setPositionState failed:', posError.message);
                }
            } catch (error) {
                console.error('Media Session API error:', error);
            }
        }
    }, []);

    const setupMediaSessionHandlers = useCallback((handleTransport) => {
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.setActionHandler('play', () => handleTransport('play-pause'));
                navigator.mediaSession.setActionHandler('pause', () => handleTransport('play-pause'));
                navigator.mediaSession.setActionHandler('previoustrack', () => handleTransport('previous'));
                navigator.mediaSession.setActionHandler('nexttrack', () => handleTransport('next'));
                navigator.mediaSession.setActionHandler('stop', () => handleTransport('stop'));

                try {
                    navigator.mediaSession.setActionHandler('seekto', (details) => {
                        if (details.seekTime !== undefined) {
                            const currentState = stateRef.current;
                            skipTo(currentState.currentIndex, details.seekTime);
                        }
                    });
                } catch (e) {}

                try {
                    navigator.mediaSession.setActionHandler('seekbackward', () => {
                        const currentState = stateRef.current;
                        const newPos = Math.max(0, currentState.position - 10);
                        skipTo(currentState.currentIndex, newPos);
                    });
                } catch (e) {}

                try {
                    navigator.mediaSession.setActionHandler('seekforward', () => {
                        const currentState = stateRef.current;
                        const track = currentState.playlist[currentState.currentIndex];
                        const maxPos = track?.duration || 0;
                        const newPos = Math.min(maxPos, currentState.position + 10);
                        skipTo(currentState.currentIndex, newPos);
                    });
                } catch (e) {}
            } catch (error) {
                console.error('Error setting up Media Session handlers:', error);
            }
        }
    }, []);

    // --- Core State Refresh Logic ---
    const refreshState = useCallback(async (forceUpdate = false) => {
        if (!forceUpdate && commandInProgress.current) {
            return;
        }
        
        try {
            const result = await callJukebox('get');
            const { status, playlist } = result;
            
            const newPlaylist = Array.isArray(playlist?.entry) 
                ? playlist.entry 
                : (playlist?.entry ? [playlist.entry] : []);
            
            setState(prevState => {
                const currentTrack = newPlaylist[status.currentIndex || 0];
                const prevTrack = prevState.playlist[prevState.currentIndex];
                
                return {
                    ...prevState,
                    playing: status.playing,
                    currentIndex: status.currentIndex,
                    position: status.position,
                    gain: status.gain,
                    playlist: newPlaylist,
                    lastStatusTs: Date.now(),
                    localTickStart: status.position,
                    endHandledForId: currentTrack?.id !== prevTrack?.id ? null : prevState.endHandledForId,
                };
            });
            
            setStatusText(status.playing ? '▶️ Playing' : '⏸️ Paused');
        } catch (e) {
            if (e.message === 'Authentication failed' || e.message === 'Not authenticated') {
                setIsAuthenticated(false);
                setStatusText('Session expired. Please log in again.');
            } else {
                setStatusText(`Error: ${e.message}`);
            }
            console.error('Refresh failed:', e);
        }
    }, []);

    const skipTo = useCallback(async (index, offsetSec = 0) => {
        const currentState = stateRef.current;
        index = Math.max(0, Math.min(index, currentState.playlist.length - 1));
        
        commandInProgress.current = true;
        try {
            await callJukebox('skip', `&index=${index}&offset=${Math.max(0, Math.floor(offsetSec))}`);
            await refreshState(true);
        } catch (e) {
            console.error(e);
        } finally {
            commandInProgress.current = false;
        }
    }, [refreshState]);

    const handleTransport = useCallback(async (action) => {
        const currentState = stateRef.current;
        
        commandInProgress.current = true;
        try {
            if (action === 'play-pause') {
                const cmd = currentState.playing ? 'stop' : 'start';
                await callJukebox(cmd);
                setState(prev => ({ ...prev, playing: !prev.playing }));
            } else if (action === 'next') {
                await callJukebox('skip', `&index=${currentState.currentIndex + 1}&offset=0`);
            } else if (action === 'previous') {
                const restart = (currentState.position || 0) > 3;
                if (restart) {
                    await callJukebox('skip', `&index=${currentState.currentIndex}&offset=0`);
                } else {
                    await callJukebox('skip', `&index=${Math.max(0, currentState.currentIndex - 1)}&offset=0`);
                }
            } else if (action === 'clear') {
                if (!confirm('Clear the whole queue?')) {
                    commandInProgress.current = false;
                    return;
                }
                await callJukebox('clear');
            } else if (action === 'shuffle') {
                await callJukebox('shuffle');
            } else if (action === 'stop') {
                await callJukebox('stop');
                setState(prev => ({ ...prev, playing: false }));
            } else if (action === 'addRandom') {
                setStatusText('Adding random song…');
                const { randomSong } = await addRandomSong();
                if (!currentState.playing && currentState.playlist.length === 0) {
                    await callJukebox('start');
                }
                setStatusText(`Random song added: ${randomSong.title}!`);
            }
            
            await refreshState(true);
            setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
        } catch (e) {
            setStatusText(`Action failed: ${e.message}`);
            console.error('Transport action failed:', e);
        } finally {
            commandInProgress.current = false;
        }
    }, [refreshState]);

    const handleQueueAction = useCallback(async (action, index) => {
        commandInProgress.current = true;
        try {
            if (action === 'play') {
                await skipTo(index, 0);
            } else if (action === 'remove') {
                await callJukebox('remove', `&index=${index}`);
                await refreshState(true);
            }
        } catch(e) {
            console.error(e);
        } finally {
            commandInProgress.current = false;
        }
    }, [skipTo, refreshState]);
    
    // --- Effects & Listeners ---

    useEffect(() => {
        setupMediaSessionHandlers(handleTransport);
    }, [setupMediaSessionHandlers, handleTransport]);

    useEffect(() => {
        const currentTrack = state.playlist[state.currentIndex];
        if (currentTrack) {
            updateMediaSession(currentTrack, state.position, state.playing);
        }
    }, [state.currentIndex, state.playlist, state.position, state.playing, updateMediaSession]);

    // Initialization - try to reconnect with saved credentials
    useEffect(() => {
        let mounted = true;
        
        (async function init() {
            try {
                const savedConfig = getConfig();
                if (savedConfig.username) {
                    setConfigForm(savedConfig);
                    setStatusText('Reconnecting…');
                    
                    const connected = await reconnect();
                    
                    if (!mounted) return;
                    
                    if (connected) {
                        setIsAuthenticated(true);
                        await refreshState(true);
                        
                        const { playlist } = await callJukebox('get');
                        const currentPlaylist = Array.isArray(playlist.entry) ? playlist.entry : (playlist.entry ? [playlist.entry] : []);
                        
                        if (mounted && currentPlaylist.length === 0) {
                            for (let i = 0; i < 3; i++) {
                                if (!mounted) break;
                                await addRandomSong();
                            }
                            if (mounted) {
                                await refreshState(true);
                            }
                        }
                        
                        if (mounted) {
                            setStatusText('Ready');
                        }
                    } else {
                        setIsAuthenticated(false);
                        setStatusText('Please log in');
                    }
                } else {
                    setStatusText('Please log in');
                }
            } catch (e) {
                console.error(e);
                if (mounted) {
                    setIsAuthenticated(false);
                    setStatusText('Please log in');
                }
            }
        })();
        
        return () => { mounted = false; };
    }, [refreshState]);

    // Polling loop
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const pollInterval = setInterval(() => {
            refreshState(false);
        }, 2000);
        
        return () => clearInterval(pollInterval);
    }, [refreshState, isAuthenticated]);

    // Position ticker and auto-repeat
    useEffect(() => {
        const tickInterval = setInterval(() => {
            setState(prevState => {
                if (!prevState.playing || prevState.seeking) {
                    return prevState;
                }
                
                const tr = prevState.playlist[prevState.currentIndex];
                const dur = Math.max(0, tr?.duration || 0);
                const dt = (Date.now() - prevState.lastStatusTs) / 1000;
                let pos = Math.min(dur, prevState.localTickStart + dt);
                
                if (dur > 3 && (dur - pos) <= 0.8 && prevState.endHandledForId !== tr?.id) {
                    const currentId = tr?.id;
                    if (prevState.repeatMode === 'one') {
                        setTimeout(() => skipTo(prevState.currentIndex, 0), 0);
                        return { ...prevState, position: pos, endHandledForId: currentId };
                    } else if (prevState.repeatMode === 'all' && prevState.currentIndex === prevState.playlist.length - 1) {
                        setTimeout(() => skipTo(0, 0), 0);
                        return { ...prevState, position: pos, endHandledForId: currentId };
                    }
                }
                
                return { ...prevState, position: pos };
            });
        }, 500);

        return () => clearInterval(tickInterval);
    }, [skipTo]);

    // Volume Change Handler
    const handleVolumeChange = useCallback(async (e) => {
        const volumeValue = Number(e.target.value);
        const gain = Math.max(0, Math.min(1, volumeValue / 100));
        
        setState(prev => ({ ...prev, gain }));
        
        try {
            await callJukebox('setGain', `&gain=${gain}`);
        } catch (e) {
            console.error(e);
        }
    }, []);

    // Seek Logic
    const handleSeekInput = useCallback((e) => {
        setState(prevState => {
            const tr = prevState.playlist[prevState.currentIndex];
            const dur = Math.max(0, tr?.duration || 0);
            const fill = Number(e.target.value);
            const pos = (fill / 1000) * dur;
            
            return { 
                ...prevState, 
                seeking: true, 
                position: pos,
                localTickStart: pos,
                lastStatusTs: Date.now(),
            };
        });
    }, []);
    
    const handleSeekChange = useCallback(async (e) => {
        const currentState = stateRef.current;
        const tr = currentState.playlist[currentState.currentIndex];
        const dur = Math.max(0, tr?.duration || 0);
        const pos = (Number(e.target.value) / 1000) * dur;
        
        setState(prev => ({ ...prev, seeking: false }));
        await skipTo(currentState.currentIndex, pos);
    }, [skipTo]);
    
    // Search Logic
    useEffect(() => {
        let searchTimer;
        const q = searchQuery.trim();
        if (q.length >= 2) {
            searchTimer = setTimeout(async () => {
                try {
                    const results = await searchSongs(q);
                    setSearchResults(results);
                } catch (e) {
                    console.error('Search failed:', e);
                    setSearchResults([]);
                }
            }, 250);
        } else {
            setSearchResults([]);
        }
        return () => clearTimeout(searchTimer);
    }, [searchQuery]);

    const addSongFromSearch = useCallback(async (id) => {
        const currentState = stateRef.current;
        commandInProgress.current = true;
        
        try {
            await callJukebox('add', `&id=${encodeURIComponent(id)}`);
            if (!currentState.playing && currentState.playlist.length === 0) {
                await callJukebox('start');
            }
            setSearchQuery('');
            await refreshState(true);
        } catch (e) {
            console.error(e);
        } finally {
            commandInProgress.current = false;
        }
    }, [refreshState]);
    
    // Login Logic (SIMPLIFIED)
    const handleConfigChange = useCallback((e) => {
        setConfigForm(f => ({ ...f, [e.target.id]: e.target.value }));
    }, []);
    
    const handleLogin = useCallback(async () => {
        const { serverUrl, username, password } = configForm;
        
        if (!username || !password) {
            setStatusText('Please enter username and password');
            return;
        }
        
        try {
            setStatusText('Logging in…');
            
            await authenticate(serverUrl, username, password);
            
            setIsAuthenticated(true);
            setStatusText('Connected! Loading player…');
            
            await refreshState(true);
            
            const currentState = stateRef.current;
            if (currentState.playlist.length === 0) {
                await handleTransport('addRandom');
            }
            
            setStatusText(currentState.playing ? '▶️ Playing' : 'Ready');
            
            // Clear password from form for security
            setConfigForm(f => ({ ...f, password: '' }));
            
        } catch (e) {
            setIsAuthenticated(false);
            setStatusText(`Login failed: ${e.message}`);
            console.error('Login error:', e);
        }
    }, [configForm, refreshState, handleTransport]);

    // --- Derived State ---
    const currentTrack = state.playlist[state.currentIndex];
    
    const seekValue = useMemo(() => {
        const tr = state.playlist[state.currentIndex];
        const dur = Math.max(0, tr?.duration || 0);
        const pos = Math.max(0, Math.min(dur, state.position));
        return dur ? Math.round((pos / dur) * 1000) : 0;
    }, [state.position, state.currentIndex, state.playlist]);
    
    const seekFillStyle = useMemo(() => ({
        '--seek-fill': `${(seekValue / 10).toFixed(1)}%`
    }), [seekValue]);
    
    const volFillStyle = useMemo(() => ({
        '--vol-fill': `${Math.round(state.gain * 100)}%`
    }), [state.gain]);

    const hasMediaSession = 'mediaSession' in navigator;

    // --- RENDER ---
    return (
        <div className="player-shell">
            <aside className="cover-card">
                <img className="cover" alt="Album art" src={coverArtUrl(currentTrack?.coverArt, 900)} />
                <div className="meta">
                    <div className="title">{currentTrack?.title || 'Nothing playing'}</div>
                    <div className="artist">{currentTrack?.artist || '—'}</div>
                    <div className="album">{currentTrack?.album || ''}&nbsp;</div>
                </div>
            </aside>

            <main className="transport-card">
                <div className="status-row">
                    <div>{statusText}</div>
                    <div className="small">
                        Queue: {state.playlist.length} tracks
                        {hasMediaSession && <span> • 🎵 Media Controls</span>}
                    </div>
                </div>
                
                <div className="progress">
                    <div className="time">{fmtTime(state.position)}</div>
                    <input 
                        className="seek" 
                        type="range" 
                        min="0" 
                        max="1000" 
                        value={seekValue} 
                        style={seekFillStyle}
                        onChange={handleSeekChange}
                        onInput={handleSeekInput}
                        disabled={!isAuthenticated}
                    />
                    <div className="time">{fmtTime(currentTrack?.duration || 0)}</div>
                </div>
                
                <div>
                    <div className="controls">
                        <button 
                            className="btn" 
                            onClick={() => handleTransport('shuffle')}
                            disabled={!isAuthenticated || commandInProgress.current}>🔀</button>
                        <button 
                            className="btn" 
                            onClick={() => handleTransport('previous')}
                            disabled={!isAuthenticated || commandInProgress.current}>⏮️</button>
                        <button 
                            className={`btn primary ${state.playing ? 'paused' : ''}`}
                            onClick={() => handleTransport('play-pause')}
                            disabled={!isAuthenticated || commandInProgress.current}>
                            {state.playing ? '⏸️' : '▶️'}
                        </button>
                        <button 
                            className="btn" 
                            onClick={() => handleTransport('next')}
                            disabled={!isAuthenticated || commandInProgress.current}>⏭️</button>
                        <button 
                            className={`btn ${state.repeatMode !== 'off' ? 'active' : ''}`}
                            onClick={() => setState(s => ({ 
                                ...s, 
                                repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off'
                            }))}
                            disabled={!isAuthenticated}>
                            {state.repeatMode === 'one' ? '🔂1' : state.repeatMode === 'all' ? '🔂' : '🔁'}
                        </button>
                        <button 
                            className="btn warn" 
                            onClick={() => handleTransport('stop')}
                            disabled={!isAuthenticated || commandInProgress.current}>⏹️</button>
                        <button 
                            className="btn danger" 
                            onClick={() => handleTransport('clear')}
                            disabled={!isAuthenticated || commandInProgress.current}>🗑️</button>
                        <button 
                            className="btn" 
                            onClick={() => handleTransport('addRandom')}
                            disabled={!isAuthenticated || commandInProgress.current}>🎲</button>
                    </div>
                    
                    <div className="vol">
                        <div className="vol-row">
                            <div>🔊</div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={Math.round(state.gain * 100)}
                                style={volFillStyle}
                                onChange={handleVolumeChange}
                                onInput={handleVolumeChange}
                                disabled={!isAuthenticated}
                            />
                            <div className="volpct">{Math.round(state.gain * 100)}%</div>
                        </div>
                    </div>
                </div>
            </main>

            <aside className="side-card">
                <h3>Queue</h3>
                <div className="queue">
                    {state.playlist.map((song, index) => (
                        <JukeboxQueueItem 
                            key={song.id || index} 
                            song={song}
                            index={index}
                            currentIndex={state.currentIndex}
                            onAction={handleQueueAction}
                        />
                    ))}
                </div>
                
                <div className="search-box">
                    <input 
                        placeholder="Search songs to add…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={!isAuthenticated}
                    />
                    <div className="search-results" hidden={searchResults.length === 0}>
                        {searchResults.map((song) => (
                            <div key={song.id} className="srow" onClick={() => addSongFromSearch(song.id)}>
                                <img 
                                    src={coverArtUrl(song.coverArt, 80)} 
                                    alt="Cover" 
                                    onError={(e) => e.target.style.visibility='hidden'}
                                />
                                <div className="s-meta">
                                    <div className="qi-title">{escapeHtml(song.title || 'Unknown')}</div>
                                    <div className="s-artist">{escapeHtml(song.artist || '')} • {escapeHtml(song.album || '')}</div>
                                </div>
                                <div style={{textAlign: 'right'}}>➕</div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="config">
                    <div className="row">
                        <input 
                            id="serverUrl" 
                            placeholder="Server URL (optional - leave empty to use nginx proxy)"
                            value={configForm.serverUrl || ''}
                            onChange={handleConfigChange}
                            disabled={isAuthenticated}
                        />
                        <input 
                            id="username" 
                            placeholder="Username"
                            value={configForm.username || ''}
                            onChange={handleConfigChange}
                            disabled={isAuthenticated}
                        />
                        <input 
                            id="password" 
                            placeholder="Password" 
                            type="password"
                            value={configForm.password || ''}
                            onChange={handleConfigChange}
                            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                            disabled={isAuthenticated}
                        />
                        <button onClick={handleLogin} disabled={isAuthenticated}>
                            {isAuthenticated ? '✓ Logged In' : 'Login'}
                        </button>
                    </div>
                    <div className="small">
                        {isAuthenticated 
                            ? '✓ Connected to server. Your password is never stored.' 
                            : '💡 Tip: Leave Server URL empty if using the built-in nginx proxy. Only fill it if connecting to a different Navidrome server.'}
                    </div>
                </div>
            </aside>
        </div>
    );
}
