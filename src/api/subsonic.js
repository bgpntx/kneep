/**
 * Subsonic/Navidrome API client for Jukebox control.
 * Handles authentication, session management, and all API calls.
 */
import { md5 } from '../utils/md5.js';

export const API_VERSION = '1.16.1';
const CACHE_VERSION = 'v2'; // Increment this to invalidate old cache

export const DEBUG = () => typeof window !== 'undefined' && window.JUKEBOX_DEBUG === true;

// Cache key helpers with versioning
export const cacheKey = (key) => `jukebox_${CACHE_VERSION}_${key}`;

// Clear old cache versions on load
function clearOldCache() {
    const keysToCheck = ['jukeboxConfig', 'jukeboxPlaybackState', 'jukeboxScrobbled'];
    keysToCheck.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            if (DEBUG()) console.log(`Cleared old cache key: ${key}`);
        }
    });
    // Clear any old versioned keys (collect first to avoid index-shift bug)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('jukebox_') && !key.startsWith(`jukebox_${CACHE_VERSION}_`)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        if (DEBUG()) console.log(`Cleared old versioned cache: ${key}`);
    });
}

// Initialize cache cleanup
clearOldCache();

let config = JSON.parse(localStorage.getItem(cacheKey('config'))) || {
    serverUrl: '',
    username: '',
    token: '',
    salt: ''
};

function generateSalt() { return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
function generateToken(password, salt) { return md5(password + salt); }

export function isSessionValid() { return !!(config.token && config.salt && config.username); }

export function clearSession() {
    const serverUrl = config.serverUrl;
    localStorage.removeItem(cacheKey('config'));
    config = { serverUrl: serverUrl, username: '', token: '', salt: '' };
    if (DEBUG()) console.log('Session cleared');
}

export function buildJukeboxUrl(action, extra = '') {
    if (!config.token || !config.salt) throw new Error('Not authenticated');
    const base = `${config.serverUrl}/rest/jukeboxControl?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json`;
    return `${base}&action=${action}${extra}`;
}

export function coverArtUrl(id, size = 512) {
    if (!id || !config.token || !config.salt) return '';
    return `${config.serverUrl}/rest/getCoverArt?id=${encodeURIComponent(id)}&size=${size}&u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox`;
}

export async function callJukebox(action, extra = '') {
    if (!isSessionValid()) throw new Error('Not authenticated');
    const url = buildJukeboxUrl(action, extra);
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) { clearSession(); throw new Error('Authentication failed'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (DEBUG()) console.log(`API ${action} response:`, data);
    const resp = data?.['subsonic-response'];
    if (resp?.status !== 'ok') { const errorMsg = resp?.error?.message || 'Unknown API error'; throw new Error(`API failed: ${errorMsg}`); }
    const playlistObj = resp.jukeboxPlaylist || {};
    const statusObj = resp.jukeboxStatus || playlistObj;
    const status = { currentIndex: statusObj.currentIndex ?? 0, playing: statusObj.playing ?? false, gain: statusObj.gain ?? 1, position: statusObj.position ?? 0, };
    const playlist = { entry: playlistObj.entry || [] };
    return { status, playlist };
}

export async function getRandomSongFromServer() {
    if (!isSessionValid()) throw new Error('Not authenticated');
    const url = `${config.serverUrl}/rest/getRandomSongs?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json&size=1`;
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) { clearSession(); throw new Error('Authentication failed'); }
    const data = await res.json();
    const resp = data?.['subsonic-response'];
    if (resp?.status !== 'ok') throw new Error(`API failed: ${resp?.error?.message || 'Unknown error'}`);
    const song = Array.isArray(resp.randomSongs?.song) ? resp.randomSongs.song[0] : resp.randomSongs?.song;
    if (!song || !song.id) throw new Error('Server returned no songs.');
    return song;
}

export async function addRandomSong() {
    const randomSong = await getRandomSongFromServer();
    const resp = await callJukebox('add', `&id=${encodeURIComponent(randomSong.id)}`);
    return { randomSong, resp };
}

export async function searchSongs(query) {
    if (query.length < 2) return [];
    if (!isSessionValid()) throw new Error('Not authenticated');
    const url = `${config.serverUrl}/rest/search3?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) { clearSession(); throw new Error('Authentication failed'); }
    const data = await res.json();
    return data?.['subsonic-response']?.searchResult3?.song || [];
}

export async function scrobble(id, submission = false) {
    if (!isSessionValid() || !id) {
        if (DEBUG()) console.log('Scrobble skipped: not authenticated or missing song ID.');
        return;
    }
    const extra = `&id=${encodeURIComponent(id)}&submission=${submission}`;
    const url = `${config.serverUrl}/rest/scrobble?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json${extra}`;
    try {
        const res = await fetch(url);
        if (!res.ok) { if (DEBUG()) console.warn(`Scrobble API returned HTTP ${res.status}`); return; }
        const data = await res.json();
        const resp = data?.['subsonic-response'];
        if (DEBUG()) { const type = submission ? 'Scrobble' : 'Now Playing'; console.log(`${type} response for ID ${id}:`, data); }
        if (resp?.status !== 'ok') { if (DEBUG()) console.warn(`Scrobble API error: ${resp?.error?.message}`); }
    } catch (error) { if (DEBUG()) console.error('Scrobble call failed:', error.message); }
}

export function getConfig() { return { serverUrl: config.serverUrl, username: config.username }; }

export async function authenticate(serverUrl, username, password) {
    if (!username || !password) throw new Error('Username and password are required');
    serverUrl = serverUrl || '';
    const salt = generateSalt();
    const token = generateToken(password, salt);
    const testUrl = `${serverUrl}/rest/ping?u=${encodeURIComponent(username)}&t=${token}&s=${salt}&v=${API_VERSION}&c=ModernJukebox&f=json`;
    const res = await fetch(testUrl);
    if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const resp = data?.['subsonic-response'];
    if (resp?.status !== 'ok') { const errorMsg = resp?.error?.message || 'Authentication failed'; throw new Error(errorMsg); }
    config = { serverUrl, username, token, salt };
    localStorage.setItem(cacheKey('config'), JSON.stringify(config));
    if (DEBUG()) { console.log('Authentication successful'); }
    return config;
}

export async function reconnect() {
    if (!isSessionValid()) return false;
    try { await callJukebox('get'); return true; } catch (error) { clearSession(); return false; }
}
