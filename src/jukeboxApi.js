// src/jukeboxApi.js - Simplified Authentication (Username/Password Only)

const API_VERSION = '1.16.1';

// Debug logging
const DEBUG = () => typeof window !== 'undefined' && window.JUKEBOX_DEBUG === true;

// Global configuration state
let config = JSON.parse(localStorage.getItem('jukeboxConfig')) || {
    serverUrl: '',
    username: '',
    token: '',
    salt: ''
};

// --- MD5 Hash Function (for Subsonic authentication) ---
function md5(string) {
    function rotateLeft(value, shift) {
        return (value << shift) | (value >>> (32 - shift));
    }
    
    function addUnsigned(x, y) {
        return (x + y) >>> 0;
    }
    
    function f(x, y, z) { return (x & y) | (~x & z); }
    function g(x, y, z) { return (x & z) | (y & ~z); }
    function h(x, y, z) { return x ^ y ^ z; }
    function i(x, y, z) { return y ^ (x | ~z); }
    
    function ff(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function gg(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function hh(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function ii(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    
    function convertToWordArray(str) {
        const wordArray = [];
        for (let i = 0; i < str.length * 8; i += 8) {
            wordArray[i >> 5] |= (str.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return wordArray;
    }
    
    function wordToHex(value) {
        let hex = '';
        for (let i = 0; i < 4; i++) {
            hex += ((value >> (i * 8 + 4)) & 0x0F).toString(16) + ((value >> (i * 8)) & 0x0F).toString(16);
        }
        return hex;
    }
    
    const x = convertToWordArray(string);
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    
    x[string.length * 8 >> 5] |= 0x80 << (string.length * 8 % 32);
    x[(((string.length * 8 + 64) >>> 9) << 4) + 14] = string.length * 8;
    
    for (let i = 0; i < x.length; i += 16) {
        const oldA = a, oldB = b, oldC = c, oldD = d;
        
        a = ff(a, b, c, d, x[i + 0], 7, 0xD76AA478);
        d = ff(d, a, b, c, x[i + 1], 12, 0xE8C7B756);
        c = ff(c, d, a, b, x[i + 2], 17, 0x242070DB);
        b = ff(b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
        a = ff(a, b, c, d, x[i + 4], 7, 0xF57C0FAF);
        d = ff(d, a, b, c, x[i + 5], 12, 0x4787C62A);
        c = ff(c, d, a, b, x[i + 6], 17, 0xA8304613);
        b = ff(b, c, d, a, x[i + 7], 22, 0xFD469501);
        a = ff(a, b, c, d, x[i + 8], 7, 0x698098D8);
        d = ff(d, a, b, c, x[i + 9], 12, 0x8B44F7AF);
        c = ff(c, d, a, b, x[i + 10], 17, 0xFFFF5BB1);
        b = ff(b, c, d, a, x[i + 11], 22, 0x895CD7BE);
        a = ff(a, b, c, d, x[i + 12], 7, 0x6B901122);
        d = ff(d, a, b, c, x[i + 13], 12, 0xFD987193);
        c = ff(c, d, a, b, x[i + 14], 17, 0xA679438E);
        b = ff(b, c, d, a, x[i + 15], 22, 0x49B40821);
        
        a = gg(a, b, c, d, x[i + 1], 5, 0xF61E2562);
        d = gg(d, a, b, c, x[i + 6], 9, 0xC040B340);
        c = gg(c, d, a, b, x[i + 11], 14, 0x265E5A51);
        b = gg(b, c, d, a, x[i + 0], 20, 0xE9B6C7AA);
        a = gg(a, b, c, d, x[i + 5], 5, 0xD62F105D);
        d = gg(d, a, b, c, x[i + 10], 9, 0x02441453);
        c = gg(c, d, a, b, x[i + 15], 14, 0xD8A1E681);
        b = gg(b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
        a = gg(a, b, c, d, x[i + 9], 5, 0x21E1CDE6);
        d = gg(d, a, b, c, x[i + 14], 9, 0xC33707D6);
        c = gg(c, d, a, b, x[i + 3], 14, 0xF4D50D87);
        b = gg(b, c, d, a, x[i + 8], 20, 0x455A14ED);
        a = gg(a, b, c, d, x[i + 13], 5, 0xA9E3E905);
        d = gg(d, a, b, c, x[i + 2], 9, 0xFCEFA3F8);
        c = gg(c, d, a, b, x[i + 7], 14, 0x676F02D9);
        b = gg(b, c, d, a, x[i + 12], 20, 0x8D2A4C8A);
        
        a = hh(a, b, c, d, x[i + 5], 4, 0xFFFA3942);
        d = hh(d, a, b, c, x[i + 8], 11, 0x8771F681);
        c = hh(c, d, a, b, x[i + 11], 16, 0x6D9D6122);
        b = hh(b, c, d, a, x[i + 14], 23, 0xFDE5380C);
        a = hh(a, b, c, d, x[i + 1], 4, 0xA4BEEA44);
        d = hh(d, a, b, c, x[i + 4], 11, 0x4BDECFA9);
        c = hh(c, d, a, b, x[i + 7], 16, 0xF6BB4B60);
        b = hh(b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
        a = hh(a, b, c, d, x[i + 13], 4, 0x289B7EC6);
        d = hh(d, a, b, c, x[i + 0], 11, 0xEAA127FA);
        c = hh(c, d, a, b, x[i + 3], 16, 0xD4EF3085);
        b = hh(b, c, d, a, x[i + 6], 23, 0x04881D05);
        a = hh(a, b, c, d, x[i + 9], 4, 0xD9D4D039);
        d = hh(d, a, b, c, x[i + 12], 11, 0xE6DB99E5);
        c = hh(c, d, a, b, x[i + 15], 16, 0x1FA27CF8);
        b = hh(b, c, d, a, x[i + 2], 23, 0xC4AC5665);
        
        a = ii(a, b, c, d, x[i + 0], 6, 0xF4292244);
        d = ii(d, a, b, c, x[i + 7], 10, 0x432AFF97);
        c = ii(c, d, a, b, x[i + 14], 15, 0xAB9423A7);
        b = ii(b, c, d, a, x[i + 5], 21, 0xFC93A039);
        a = ii(a, b, c, d, x[i + 12], 6, 0x655B59C3);
        d = ii(d, a, b, c, x[i + 3], 10, 0x8F0CCC92);
        c = ii(c, d, a, b, x[i + 10], 15, 0xFFEFF47D);
        b = ii(b, c, d, a, x[i + 1], 21, 0x85845DD1);
        a = ii(a, b, c, d, x[i + 8], 6, 0x6FA87E4F);
        d = ii(d, a, b, c, x[i + 15], 10, 0xFE2CE6E0);
        c = ii(c, d, a, b, x[i + 6], 15, 0xA3014314);
        b = ii(b, c, d, a, x[i + 13], 21, 0x4E0811A1);
        a = ii(a, b, c, d, x[i + 4], 6, 0xF7537E82);
        d = ii(d, a, b, c, x[i + 11], 10, 0xBD3AF235);
        c = ii(c, d, a, b, x[i + 2], 15, 0x2AD7D2BB);
        b = ii(b, c, d, a, x[i + 9], 21, 0xEB86D391);
        
        a = addUnsigned(a, oldA);
        b = addUnsigned(b, oldB);
        c = addUnsigned(c, oldC);
        d = addUnsigned(d, oldD);
    }
    
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// Generate random salt
function generateSalt() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Generate token from password + salt
function generateToken(password, salt) {
    return md5(password + salt);
}

// --- Session Management ---

export function isSessionValid() {
    return !!(config.token && config.salt && config.username);
}

export function clearSession() {
    const serverUrl = config.serverUrl;
    localStorage.removeItem('jukeboxConfig');
    config = {
        serverUrl: serverUrl,
        username: '',
        token: '',
        salt: ''
    };
    if (DEBUG()) console.log('Session cleared');
}

// --- Utilities ---

export function escapeHtml(s) {
    return String(s);
}

function buildJukeboxUrl(action, extra = '') {
    if (!config.token || !config.salt) {
        throw new Error('Not authenticated');
    }
    const base = `${config.serverUrl}/rest/jukeboxControl?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json`;
    return `${base}&action=${action}${extra}`;
}

export function coverArtUrl(id, size = 512) {
    if (!id || !config.token || !config.salt) return '';
    return `${config.serverUrl}/rest/getCoverArt?id=${encodeURIComponent(id)}&size=${size}&u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox`;
}

// --- Main API Call ---

export async function callJukebox(action, extra = '') {
    if (!isSessionValid()) {
        throw new Error('Not authenticated');
    }
    
    const url = buildJukeboxUrl(action, extra);
    
    try {
        const res = await fetch(url);
        
        if (res.status === 401 || res.status === 403) {
            clearSession();
            throw new Error('Authentication failed');
        }
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        
        if (DEBUG()) console.log(`API ${action} response:`, data);
        
        const resp = data?.['subsonic-response'];
        if (resp?.status !== 'ok') {
            const errorMsg = resp?.error?.message || 'Unknown API error';
            throw new Error(`API failed: ${errorMsg}`);
        }
        
        // Parse response
        const playlistObj = resp.jukeboxPlaylist || {};
        const statusObj = resp.jukeboxStatus || playlistObj;
        
        const status = {
            currentIndex: statusObj.currentIndex ?? 0,
            playing: statusObj.playing ?? false,
            gain: statusObj.gain ?? 1,
            position: statusObj.position ?? 0,
        };
        
        const playlist = {
            entry: playlistObj.entry || []
        };
        
        return { status, playlist };
        
    } catch (error) {
        if (error.message === 'Authentication failed') {
            throw error;
        }
        throw error;
    }
}

// --- Search & Random Songs ---

async function getRandomSongFromServer() {
    if (!isSessionValid()) {
        throw new Error('Not authenticated');
    }
    
    const url = `${config.serverUrl}/rest/getRandomSongs?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json&size=1`;
    
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) {
        clearSession();
        throw new Error('Authentication failed');
    }
    
    const data = await res.json();
    const resp = data?.['subsonic-response'];
    
    if (resp?.status !== 'ok') {
        throw new Error(`API failed: ${resp?.error?.message || 'Unknown error'}`);
    }
    
    const song = Array.isArray(resp.randomSongs?.song) 
        ? resp.randomSongs.song[0] 
        : resp.randomSongs?.song;
        
    if (!song || !song.id) {
        throw new Error('Server returned no songs.');
    }
    
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
    if (res.status === 401 || res.status === 403) {
        clearSession();
        throw new Error('Authentication failed');
    }
    
    const data = await res.json();
    return data?.['subsonic-response']?.searchResult3?.song || [];
}

// --- Config Management (SIMPLIFIED) ---

export function getConfig() {
    return {
        serverUrl: config.serverUrl,
        username: config.username
    };
}

/**
 * Authenticate with username and password
 * Generates new token/salt each time
 * @param {string} serverUrl 
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<Object>} config with token/salt
 */
export async function authenticate(serverUrl, username, password) {
    if (!serverUrl || !username || !password) {
        throw new Error('Server URL, username, and password are required');
    }
    
    // Generate new salt and token
    const salt = generateSalt();
    const token = generateToken(password, salt);
    
    // Test authentication with ping
    const testUrl = `${serverUrl}/rest/ping?u=${encodeURIComponent(username)}&t=${token}&s=${salt}&v=${API_VERSION}&c=ModernJukebox&f=json`;
    
    const res = await fetch(testUrl);
    if (!res.ok) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    const resp = data?.['subsonic-response'];
    
    if (resp?.status !== 'ok') {
        const errorMsg = resp?.error?.message || 'Authentication failed';
        throw new Error(errorMsg);
    }
    
    // Save config (no password stored!)
    config = {
        serverUrl,
        username,
        token,
        salt
    };
    
    localStorage.setItem('jukeboxConfig', JSON.stringify(config));
    
    if (DEBUG()) {
        console.log('Authentication successful');
        console.log('Token:', token);
        console.log('Salt:', salt);
    }
    
    return config;
}

/**
 * Check if we have saved credentials and try to reconnect
 * @returns {Promise<boolean>} true if reconnected successfully
 */
export async function reconnect() {
    if (!isSessionValid()) {
        return false;
    }
    
    try {
        // Test connection with a simple status call
        await callJukebox('get');
        return true;
    } catch (error) {
        clearSession();
        return false;
    }
}
