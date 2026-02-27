// src/App.jsx - v5: Modular refactor — no functional or design changes
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import './App.css';

// Modular imports
import {
    DEBUG,
    coverArtUrl,
    callJukebox,
    addRandomSong,
    searchSongs,
    scrobble,
    getConfig,
    authenticate,
    reconnect,
    isSessionValid,
    clearSession,
} from './api/subsonic.js';
import { fmtTime, formatDuration } from './utils/helpers.js';
import { PlaybackStateManager } from './utils/playbackManager.js';
import { JukeboxQueueItem } from './components/QueueItem.jsx';

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
    lastPlayingTrackId: null, // Track the last playing track for auto-remove
};

export default function App() {
    const [state, setState] = useState(initialState);
    const [statusText, setStatusText] = useState('Initializing...');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [configForm, setConfigForm] = useState({ serverUrl: '', username: '', password: '' });
    const [searchResults, setSearchResults] = useState([]);
    const [scrobbledIds, setScrobbledIds] = useState(new Set());

    const commandInProgress = useRef(false);
    const stateRef = useRef(state);
    const prevTrackIdRef = useRef(null);
    const nowPlayingIdRef = useRef(null);
    const repeatOneTriggeredRef = useRef(null);
    const playbackManager = useRef(new PlaybackStateManager());
    const lastVisibilityStateRef = useRef(!document.hidden);
    // v4: Flag to prevent auto-remove during visibility recovery
    const isRecoveringFromHiddenRef = useRef(false);

    useEffect(() => { stateRef.current = state; }, [state]);

    useEffect(() => {
        const stored = playbackManager.current.getScrobbled();
        setScrobbledIds(stored);
        if (DEBUG()) console.log('Loaded scrobbled IDs:', stored.size);
    }, []);

    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Spinnaker&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
        return () => { document.head.removeChild(fontLink); };
    }, []);

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
                } catch (e) { }

                try {
                    navigator.mediaSession.setActionHandler('seekbackward', () => {
                        const currentState = stateRef.current;
                        const newPos = Math.max(0, currentState.position - 10);
                        skipTo(currentState.currentIndex, newPos);
                    });
                } catch (e) { }

                try {
                    navigator.mediaSession.setActionHandler('seekforward', () => {
                        const currentState = stateRef.current;
                        const track = currentState.playlist[currentState.currentIndex];
                        const maxPos = track?.duration || 0;
                        const newPos = Math.min(maxPos, currentState.position + 10);
                        skipTo(currentState.currentIndex, newPos);
                    });
                } catch (e) { }
            } catch (error) {
                console.error('Error setting up Media Session handlers:', error);
            }
        }
    }, []);

    // Auto-remove finished track from queue
    const removeFinishedTrack = useCallback(async (trackId) => {
        if (!trackId || commandInProgress.current) return;

        const currentState = stateRef.current;
        const trackIndex = currentState.playlist.findIndex(t => t.id === trackId);

        if (trackIndex === -1 || trackIndex >= currentState.currentIndex) {
            // Track not found or hasn't been passed yet
            return;
        }

        if (DEBUG()) console.log(`Auto-removing finished track at index ${trackIndex}: ${trackId}`);

        try {
            commandInProgress.current = true;
            await callJukebox('remove', `&index=${trackIndex}`);
            // State will be updated by the next refresh
        } catch (e) {
            console.error('Failed to auto-remove track:', e);
        } finally {
            commandInProgress.current = false;
        }
    }, []);

    const refreshState = useCallback(async (forceUpdate = false) => {
        if (!forceUpdate && commandInProgress.current) {
            return null;
        }

        try {
            const result = await callJukebox('get');
            const { status, playlist } = result;

            const newPlaylist = Array.isArray(playlist?.entry)
                ? playlist.entry
                : (playlist?.entry ? [playlist.entry] : []);

            const currentTrack = newPlaylist[status.currentIndex || 0];
            const prevState = stateRef.current;
            const prevTrack = prevState.playlist[prevState.currentIndex];

            // v4: Detect track change for auto-remove (skip during visibility recovery)
            if (prevTrack && currentTrack && prevTrack.id !== currentTrack.id) {
                if (!isRecoveringFromHiddenRef.current) {
                    setTimeout(() => removeFinishedTrack(prevTrack.id), 100);
                }
            }

            setState(prevState => {
                if (currentTrack?.id !== prevTrack?.id) {
                    repeatOneTriggeredRef.current = null;
                }

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
                    repeatMode: prevState.repeatMode,
                    lastPlayingTrackId: currentTrack?.id
                };
            });

            setStatusText(status.playing ? '▶️ Playing' : '⏸️ Paused');

            if (currentTrack && status.playing) {
                playbackManager.current.saveState({
                    currentTrack,
                    currentIndex: status.currentIndex,
                    position: status.position,
                    playing: status.playing,
                    playlist: newPlaylist
                });
            }

            return {
                trackId: currentTrack?.id,
                title: currentTrack?.title,
                duration: currentTrack?.duration || 0,
                position: status.position,
                playing: status.playing
            };

        } catch (e) {
            if (e.message === 'Authentication failed' || e.message === 'Not authenticated') {
                setIsAuthenticated(false);
                setStatusText('Session expired. Please log in again.');
            } else {
                setStatusText(`Error: ${e.message}`);
            }
            console.error('Refresh failed:', e);
            return null;
        }
    }, [removeFinishedTrack]);

    const scrobbleTrack = useCallback(async (trackId, title, duration, playedTo) => {
        if (!trackId || duration <= 30) return false;

        if (scrobbledIds.has(trackId)) {
            if (DEBUG()) console.log(`Already scrobbled: ${title}`);
            return false;
        }

        const isHalfway = playedTo >= duration / 2;
        const isFourMinutes = playedTo >= 240;

        if (isHalfway || isFourMinutes) {
            if (DEBUG()) console.log(`✓ Scrobbling: ${title} (${playedTo.toFixed(1)}s/${duration}s)`);
            await scrobble(trackId, true);

            const newScrobbled = playbackManager.current.addScrobbled(trackId);
            setScrobbledIds(newScrobbled);

            return true;
        }

        return false;
    }, [scrobbledIds]);

    const processMissedScrobbles = useCallback(async (savedState, currentState) => {
        if (!savedState) return 0;

        const missedTracks = playbackManager.current.calculateMissedTracks(savedState, currentState);

        if (missedTracks.length === 0) {
            if (DEBUG()) console.log('No missed tracks to scrobble');
            return 0;
        }

        let scrobbleCount = 0;

        for (const track of missedTracks) {
            const scrobbled = await scrobbleTrack(track.id, track.title, track.duration, track.playedTo);
            if (scrobbled) {
                scrobbleCount++;
                if (scrobbleCount < missedTracks.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        if (scrobbleCount > 0) {
            console.log(`✓ Caught up: Scrobbled ${scrobbleCount} missed track(s)`);
        }

        return scrobbleCount;
    }, [scrobbleTrack]);

    const checkAndScrobble = useCallback(async (freshData) => {
        if (!freshData || !freshData.trackId || !freshData.playing) return;

        const { trackId, title, duration, position } = freshData;
        await scrobbleTrack(trackId, title, duration, position);
    }, [scrobbleTrack]);

    const skipTo = useCallback(async (index, offsetSec = 0) => {
        const currentState = stateRef.current;
        index = Math.max(0, Math.min(index, currentState.playlist.length - 1));

        commandInProgress.current = true;
        try {
            await callJukebox('skip', `&index=${index}&offset=${Math.max(0, Math.floor(offsetSec))}`);
            repeatOneTriggeredRef.current = null;
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
                repeatOneTriggeredRef.current = null;
            } else if (action === 'previous') {
                const restart = (currentState.position || 0) > 3;
                if (restart) {
                    await callJukebox('skip', `&index=${currentState.currentIndex}&offset=0`);
                } else {
                    await callJukebox('skip', `&index=${Math.max(0, currentState.currentIndex - 1)}&offset=0`);
                }
                repeatOneTriggeredRef.current = null;
            } else if (action === 'clear') {
                await callJukebox('clear');
                setStatusText('Queue cleared');
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
        } catch (e) {
            console.error(e);
        } finally {
            commandInProgress.current = false;
        }
    }, [skipTo, refreshState]);

    const handleRepeatClick = useCallback(() => {
        setState(prev => {
            const nextMode = prev.repeatMode === 'off' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'off';
            return { ...prev, repeatMode: nextMode };
        });
    }, []);

    const upcomingCount = useMemo(() => {
        return Math.max(0, state.playlist.length - state.currentIndex - 1);
    }, [state.playlist.length, state.currentIndex]);

    const totalQueueSeconds = useMemo(() => {
        // Only count upcoming tracks (after current)
        return state.playlist.slice(state.currentIndex + 1).reduce((sum, song) => {
            return sum + (Number(song.duration) || 0);
        }, 0);
    }, [state.playlist, state.currentIndex]);

    const totalQueueTimeStr = useMemo(() => formatDuration(totalQueueSeconds), [totalQueueSeconds]);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            const nowHidden = document.hidden;
            const wasHidden = !lastVisibilityStateRef.current;

            if (!nowHidden && wasHidden && isAuthenticated) {
                if (DEBUG()) console.log('🔄 Tab became visible - checking for missed scrobbles...');

                // v4: Disable auto-remove during recovery to prevent playback disruption
                isRecoveringFromHiddenRef.current = true;

                const savedState = playbackManager.current.loadState();
                const freshData = await refreshState(true);

                // v4: Re-enable auto-remove after state is synced
                setTimeout(() => {
                    isRecoveringFromHiddenRef.current = false;
                    if (DEBUG()) console.log('🔄 Recovery complete, auto-remove re-enabled');
                }, 500);

                if (savedState && freshData) {
                    const scrobbleCount = await processMissedScrobbles(savedState, stateRef.current);

                    if (scrobbleCount > 0) {
                        setStatusText(`✓ Caught up: ${scrobbleCount} track(s) scrobbled`);
                        setTimeout(() => {
                            setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
                        }, 3000);
                    }
                }

                await checkAndScrobble(freshData);

                const pruned = playbackManager.current.pruneScrobbled();
                setScrobbledIds(pruned);
            } else if (nowHidden && !wasHidden) {
                const currentState = stateRef.current;
                const currentTrack = currentState.playlist[currentState.currentIndex];

                if (currentTrack && currentState.playing) {
                    playbackManager.current.saveState({
                        currentTrack,
                        currentIndex: currentState.currentIndex,
                        position: currentState.position,
                        playing: currentState.playing,
                        playlist: currentState.playlist
                    });
                    if (DEBUG()) console.log('💾 Tab hidden - state saved');
                }
            }

            lastVisibilityStateRef.current = !nowHidden;
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshState, isAuthenticated, checkAndScrobble, processMissedScrobbles]);

    useEffect(() => {
        setupMediaSessionHandlers(handleTransport);
    }, [setupMediaSessionHandlers, handleTransport]);

    useEffect(() => {
        const currentTrack = state.playlist[state.currentIndex];
        if (currentTrack) {
            updateMediaSession(currentTrack, state.position, state.playing);
        }
    }, [state.currentIndex, state.playlist, state.position, state.playing, updateMediaSession]);

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

    useEffect(() => {
        if (!isAuthenticated) return;

        const pollInterval = setInterval(async () => {
            let freshData;
            try {
                freshData = await refreshState(false);
            } catch (e) {
                console.error("Background poll refresh failed:", e);
                return;
            }

            if (freshData && freshData.playing) {
                const currentState = stateRef.current;
                const currentTrack = currentState.playlist[currentState.currentIndex];
                if (currentTrack) {
                    playbackManager.current.saveState({
                        currentTrack,
                        currentIndex: currentState.currentIndex,
                        position: currentState.position,
                        playing: currentState.playing,
                        playlist: currentState.playlist
                    });
                }
            }

            await checkAndScrobble(freshData);
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [refreshState, isAuthenticated, checkAndScrobble]);

    useEffect(() => {
        const currentTrack = state.playlist[state.currentIndex];
        if (state.playing && currentTrack && nowPlayingIdRef.current !== currentTrack.id) {
            scrobble(currentTrack.id, false);
            nowPlayingIdRef.current = currentTrack.id;
        }
        if (!state.playing) {
            nowPlayingIdRef.current = null;
        }
    }, [state.playing, state.currentIndex, state.playlist]);

    useEffect(() => {
        const tickInterval = setInterval(() => {
            const currentState = stateRef.current;
            const { playing, seeking, playlist, currentIndex, lastStatusTs, localTickStart, repeatMode } = currentState;

            if (document.hidden || !playing || seeking || commandInProgress.current) {
                return;
            }

            const tr = playlist[currentIndex];
            if (!tr) return;

            const dur = Math.max(0, tr.duration || 0);
            const dt = (Date.now() - lastStatusTs) / 1000;
            const pos = Math.min(dur, localTickStart + dt);

            setState(prev => ({ ...prev, position: pos }));

            if (repeatMode === 'one' && dur > 1 && pos >= dur - 0.8 && repeatOneTriggeredRef.current !== tr.id) {
                if (DEBUG()) console.log(`Repeat One Triggered for ${tr.title}`);
                repeatOneTriggeredRef.current = tr.id;
                skipTo(currentIndex, 0);
            }

        }, 500);

        return () => clearInterval(tickInterval);
    }, [skipTo]);

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
            setSearchResults([]);
            await refreshState(true);
        } catch (e) {
            console.error(e);
        } finally {
            commandInProgress.current = false;
        }
    }, [refreshState]);

    const handleConfigChange = useCallback((e) => {
        setConfigForm(f => ({ ...f, [e.target.id]: e.target.value }));
    }, []);

    const handleLogin = useCallback(async () => {
        const { serverUrl, username, password } = configForm;
        if (!username || !password) { setStatusText('Please enter username and password'); return; }
        try {
            setStatusText('Logging in…');
            await authenticate(serverUrl, username, password);
            setIsAuthenticated(true);
            setStatusText('Connected! Loading player…');
            await refreshState(true);
            const currentState = stateRef.current;
            if (currentState.playlist.length === 0) { await handleTransport('addRandom'); }
            setStatusText(currentState.playing ? '▶️ Playing' : 'Ready');
            setConfigForm(f => ({ ...f, password: '' }));
        } catch (e) {
            setIsAuthenticated(false);
            setStatusText(`Login failed: ${e.message}`);
            console.error('Login error:', e);
        }
    }, [configForm, refreshState, handleTransport]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Generate unique keys for queue items (handles duplicate songs)
    const queueItemIds = useMemo(() => {
        return state.playlist.map((song, index) => `${song.id}-${index}`);
    }, [state.playlist]);

    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {

            const currentState = stateRef.current;
            const wasPlaying = currentState.playing;
            const currentTrack = currentState.playlist[currentState.currentIndex];
            const currentTrackId = currentTrack?.id;

            const dur = Math.max(0, currentTrack?.duration || 0);
            let precisePosition = currentState.position;
            if (wasPlaying) {
                const dt = (Date.now() - currentState.lastStatusTs) / 1000.0;
                precisePosition = Math.min(dur, currentState.localTickStart + dt);
            }
            precisePosition = Math.floor(Math.max(0, precisePosition));

            const currentPlaylist = currentState.playlist;

            // Parse composite IDs to get actual indices
            const oldIndex = parseInt(active.id.toString().split('-').pop(), 10);
            const newIndex = parseInt(over.id.toString().split('-').pop(), 10);

            if (isNaN(oldIndex) || isNaN(newIndex) || oldIndex === newIndex) return;

            const newPlaylist = arrayMove(currentPlaylist, oldIndex, newIndex);

            setState(prev => ({
                ...prev,
                playlist: newPlaylist,
                playing: wasPlaying
            }));

            const ids = newPlaylist.map(song => song.id);
            const qs = ids.map(id => `&id=${encodeURIComponent(id)}`).join('');

            try {
                commandInProgress.current = true;

                await callJukebox('set', qs);
                await new Promise(resolve => setTimeout(resolve, 50));

                const newPlayingIndex = currentTrackId
                    ? newPlaylist.findIndex(song => song.id === currentTrackId)
                    : -1;

                if (newPlayingIndex !== -1) {
                    await callJukebox('skip', `&index=${newPlayingIndex}&offset=${precisePosition}`);

                    if (wasPlaying) {
                        await callJukebox('start');
                    }
                } else if (wasPlaying) {
                    await callJukebox('skip', `&index=0&offset=0`);
                    await callJukebox('start');
                }

                await new Promise(resolve => setTimeout(resolve, 150));
                await refreshState(true);
            } catch (e) {
                console.error('Failed to reorder queue:', e);
                await refreshState(true);
            } finally {
                commandInProgress.current = false;
            }
        }
    }, [refreshState]);

    const currentTrack = state.playlist[state.currentIndex];

    const seekValue = useMemo(() => {
        const tr = state.playlist[state.currentIndex];
        const dur = Math.max(0, tr?.duration || 0);
        const pos = Math.max(0, Math.min(dur, state.position));
        return dur ? Math.round((pos / dur) * 1000) : 0;
    }, [state.position, state.currentIndex, state.playlist]);

    const seekFillStyle = useMemo(() => ({ '--seek-fill': `${(seekValue / 10).toFixed(1)}%` }), [seekValue]);
    const volFillStyle = useMemo(() => ({ '--vol-fill': `${Math.round(state.gain * 100)}%` }), [state.gain]);

    const repeatButtonText = useMemo(() => {
        if (state.repeatMode === 'one') return '🔂1';
        if (state.repeatMode === 'all') return '🔂';
        return '🔁';
    }, [state.repeatMode]);
    const repeatButtonTitle = useMemo(() => {
        if (state.repeatMode === 'one') return 'Repeat One';
        if (state.repeatMode === 'all') return 'Repeat All';
        return 'Repeat Off';
    }, [state.repeatMode]);

    return (
        <>
            <div className="player-shell">
                <aside className="cover-card">
                    <img className="cover" alt="Album art" src={coverArtUrl(currentTrack?.coverArt, 900)} />
                    <div className="meta">
                        <div className="title">{currentTrack?.title || 'Nothing playing'}</div>

                        {currentTrack && (currentTrack.suffix || currentTrack.bitRate) && (
                            <div className="format-info">
                                {currentTrack.suffix || ''}
                                {currentTrack.suffix && currentTrack.bitRate && ' • '}
                                {currentTrack.bitRate ? `${currentTrack.bitRate} kbps` : ''}
                            </div>
                        )}

                        <div className="artist">{currentTrack?.artist || '—'}</div>
                        <div className="album">{currentTrack?.album || ''}&nbsp;</div>
                    </div>
                </aside>

                <div className="transport-card">
                    <div className="status-row">
                        <div id="statusText">{statusText}</div>
                        <div className="small">Up next: <span id="queueCount">{upcomingCount}</span> tracks</div>
                    </div>
                    <div className="controls">
                        <button className="btn" title="Previous" onClick={() => handleTransport('previous')}>⏮</button>
                        <button className="btn primary" title="Play / Pause" onClick={() => handleTransport('play-pause')}>
                            {state.playing ? '⏸' : '▶'}
                        </button>
                        <button className="btn" title="Next" onClick={() => handleTransport('next')}>⏭</button>
                        <button
                            className={`btn repeat ${state.repeatMode !== 'off' ? 'active' : ''}`}
                            title={repeatButtonTitle}
                            onClick={handleRepeatClick}
                        >
                            {repeatButtonText}
                        </button>
                        <button className="btn shuffle" title="Shuffle" onClick={() => handleTransport('shuffle')}>🔀</button>
                        <button className="btn dice" title="Add random track" onClick={() => handleTransport('addRandom')}>🎲</button>
                        <button className="btn danger" title="Clear queue" onClick={() => handleTransport('clear')}>🗑️</button>
                    </div>

                    <div className="progress">
                        <div className="time">{fmtTime(state.position)}</div>
                        <input
                            className="seek" type="range" min="0" max="1000"
                            value={seekValue} style={seekFillStyle}
                            onChange={handleSeekChange} onInput={handleSeekInput}
                            disabled={!isAuthenticated}
                        />
                        <div className="time">{fmtTime(currentTrack?.duration || 0)}</div>
                    </div>

                    <div className="vol">
                        <div className="vol-row">
                            <div title="Volume">🔊</div>
                            <input
                                id="volume"
                                type="range" min="0" max="100"
                                value={Math.round(state.gain * 100)}
                                style={volFillStyle}
                                onChange={handleVolumeChange}
                                disabled={!isAuthenticated}
                            />
                            <div className="volpct">{Math.round(state.gain * 100)}%</div>
                        </div>
                    </div>
                </div>

                <aside className="side-card">
                    <h3>Up Next <small>(Total: {totalQueueTimeStr})</small></h3>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={queueItemIds}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="queue" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                                {state.playlist.map((song, index) => {
                                    // Only show tracks AFTER the current one (the actual "up next")
                                    if (index <= state.currentIndex) return null;
                                    // Number sequentially starting from 1
                                    const displayNum = index - state.currentIndex;
                                    const itemId = `${song.id}-${index}`;
                                    return (
                                        <JukeboxQueueItem
                                            key={itemId}
                                            id={itemId}
                                            song={song}
                                            index={index}
                                            displayNum={displayNum}
                                            currentIndex={state.currentIndex}
                                            onAction={handleQueueAction}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>

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
                                    <img src={coverArtUrl(song.coverArt, 80)} alt="Cover" onError={(e) => e.target.style.visibility = 'hidden'} />
                                    <div className="s-meta">
                                        <div className="qi-title">{song.title || 'Unknown'}</div>
                                        <div className="s-artist">{song.artist || ''} • {song.album || ''}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>➕</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="config">
                        <div className="row">
                            <input id="serverUrl" placeholder="Server URL" value={configForm.serverUrl || ''} onChange={handleConfigChange} disabled={isAuthenticated} />
                            <input id="username" placeholder="Username" value={configForm.username || ''} onChange={handleConfigChange} disabled={isAuthenticated} />
                            <input id="password" placeholder="Password" type="password" value={configForm.password || ''} onChange={handleConfigChange} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} disabled={isAuthenticated} />
                            <button onClick={handleLogin} disabled={isAuthenticated}>
                                {isAuthenticated ? '✓ Logged In' : 'Login'}
                            </button>
                        </div>
                        <div className="small">
                            {isAuthenticated
                                ? '✓ Connected. Played tracks auto-removed.'
                                : '💡 Tip: Leave Server URL empty if using the nginx proxy.'}
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
}
