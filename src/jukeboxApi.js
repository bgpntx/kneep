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

// --- WORKING MD5 Hash Function (for Subsonic authentication) ---
function md5(string) {
    function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }

    function addUnsigned(lX, lY) {
        const lX8 = (lX & 0x80000000);
        const lY8 = (lY & 0x80000000);
        const lX4 = (lX & 0x40000000);
        const lY4 = (lY & 0x40000000);
        const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) {
            return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        }
        if (lX4 | lY4) {
            if (lResult & 0x40000000) {
                return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            } else {
                return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
            }
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }

    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }

    function FF(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function GG(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function HH(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function II(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(string) {
        let lWordCount;
        const lMessageLength = string.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = new Array(lNumberOfWords - 1);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }

    function wordToHex(lValue) {
        let wordToHexValue = "", wordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            wordToHexValue_temp = "0" + lByte.toString(16);
            wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
        }
        return wordToHexValue;
    }

    function utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        let utftext = "";
        for (let n = 0; n < string.length; n++) {
            const c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }

    let x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

    string = utf8Encode(string);
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k + 6], S34, 0x04881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }

    const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
    return temp.toLowerCase();
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

/**
 * Scrobble a song to Last.fm via Navidrome.
 * This handles both "now playing" updates and full scrobbles.
 * @param {string} id The ID of the song to scrobble.
 * @param {boolean} submission If true, it's a full scrobble. If false, it updates "Now Playing".
 * @returns {Promise<void>}
 */
export async function scrobble(id, submission = false) {
    if (!isSessionValid() || !id) {
        if (DEBUG()) console.log('Scrobble skipped: not authenticated or missing song ID.');
        return;
    }

    const extra = `&id=${encodeURIComponent(id)}&submission=${submission}`;
    const url = `${config.serverUrl}/rest/scrobble?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json${extra}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (DEBUG()) console.warn(`Scrobble API returned HTTP ${res.status}`);
            return;
        }
        
        const data = await res.json();
        const resp = data?.['subsonic-response'];

        if (DEBUG()) {
            const type = submission ? 'Scrobble' : 'Now Playing';
            console.log(`${type} response for ID ${id}:`, data);
        }

        if (resp?.status !== 'ok') {
            if (DEBUG()) console.warn(`Scrobble API error: ${resp?.error?.message}`);
        }
        
    } catch (error) {
        if (DEBUG()) console.error('Scrobble call failed:', error.message);
    }
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
    if (!username || !password) {
        throw new Error('Username and password are required');
    }
    
    // Allow empty serverUrl for relative URLs
    serverUrl = serverUrl || '';
    
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

