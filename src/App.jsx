// src/App.jsx - All-in-one Jukebox Player with Scrobbling
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// --- Jukebox API Logic (formerly jukeboxApi.js) ---

const API_VERSION = '1.16.1';
const DEBUG = () => typeof window !== 'undefined' && window.JUKEBOX_DEBUG === true;

let config = JSON.parse(localStorage.getItem('jukeboxConfig')) || {
    serverUrl: '',
    username: '',
    token: '',
    salt: ''
};

function md5(string) {
    function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
        const lX8 = (lX & 0x80000000); const lY8 = (lY & 0x80000000);
        const lX4 = (lX & 0x40000000); const lY4 = (lY & 0x40000000);
        const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) { return (lResult ^ 0x80000000 ^ lX8 ^ lY8); }
        if (lX4 | lY4) { if (lResult & 0x40000000) { return (lResult ^ 0xC0000000 ^ lX8 ^ lY8); } else { return (lResult ^ 0x40000000 ^ lX8 ^ lY8); } } else { return (lResult ^ lX8 ^ lY8); }
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function GG(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function HH(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function II(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function convertToWordArray(string) {
        let lWordCount; const lMessageLength = string.length;
        const lNumberOfWords_temp1 = lMessageLength + 8; const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16; const lWordArray = new Array(lNumberOfWords - 1);
        let lBytePosition = 0; let lByteCount = 0;
        while (lByteCount < lMessageLength) { lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)); lByteCount++; }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition); lWordArray[lNumberOfWords - 2] = lMessageLength << 3; lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29; return lWordArray;
    }
    function wordToHex(lValue) {
        let wordToHexValue = "", wordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) { lByte = (lValue >>> (lCount * 8)) & 255; wordToHexValue_temp = "0" + lByte.toString(16); wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2); }
        return wordToHexValue;
    }
    function utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n"); let utftext = "";
        for (let n = 0; n < string.length; n++) {
            const c = string.charCodeAt(n);
            if (c < 128) { utftext += String.fromCharCode(c); } else if ((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); } else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); }
        } return utftext;
    }
    let x = []; let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22; const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23; const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = utf8Encode(string); x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756); c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE); a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A); c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501); a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF); c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE); a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193); c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340); c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA); a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x02441453); c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8); a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6); c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED); a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8); c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681); c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C); a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9); c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70); a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA); c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x04881D05); a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5); c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97); c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039); a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92); c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1); a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0); c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1); a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235); c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
    return temp.toLowerCase();
}

function generateSalt() { return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
function generateToken(password, salt) { return md5(password + salt); }
function isSessionValid() { return !!(config.token && config.salt && config.username); }
function clearSession() {
    const serverUrl = config.serverUrl;
    localStorage.removeItem('jukeboxConfig');
    config = { serverUrl: serverUrl, username: '', token: '', salt: '' };
    if (DEBUG()) console.log('Session cleared');
}
function escapeHtml(s) { return String(s); }
function buildJukeboxUrl(action, extra = '') {
    if (!config.token || !config.salt) throw new Error('Not authenticated');
    const base = `${config.serverUrl}/rest/jukeboxControl?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json`;
    return `${base}&action=${action}${extra}`;
}
function coverArtUrl(id, size = 512) {
    if (!id || !config.token || !config.salt) return '';
    return `${config.serverUrl}/rest/getCoverArt?id=${encodeURIComponent(id)}&size=${size}&u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox`;
}
async function callJukebox(action, extra = '') {
    if (!isSessionValid()) throw new Error('Not authenticated');
    const url = buildJukeboxUrl(action, extra);
    try {
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
    } catch (error) { if (error.message === 'Authentication failed') { throw error; } throw error; }
}
async function getRandomSongFromServer() {
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
async function addRandomSong() {
    const randomSong = await getRandomSongFromServer();
    const resp = await callJukebox('add', `&id=${encodeURIComponent(randomSong.id)}`);
    return { randomSong, resp };
}
async function searchSongs(query) {
    if (query.length < 2) return [];
    if (!isSessionValid()) throw new Error('Not authenticated');
    const url = `${config.serverUrl}/rest/search3?u=${encodeURIComponent(config.username)}&t=${config.token}&s=${config.salt}&v=${API_VERSION}&c=ModernJukebox&f=json&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403) { clearSession(); throw new Error('Authentication failed'); }
    const data = await res.json();
    return data?.['subsonic-response']?.searchResult3?.song || [];
}
async function scrobble(id, submission = false) {
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
function getConfig() { return { serverUrl: config.serverUrl, username: config.username }; }
async function authenticate(serverUrl, username, password) {
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
    localStorage.setItem('jukeboxConfig', JSON.stringify(config));
    if (DEBUG()) { console.log('Authentication successful'); console.log('Token:', token); console.log('Salt:', salt); }
    return config;
}
async function reconnect() {
    if (!isSessionValid()) return false;
    try { await callJukebox('get'); return true; } catch (error) { clearSession(); return false; }
}

// --- Styles (formerly App.css) ---
const styles = `
    :root {
      --base-dark: #404040;
      --bevel-hi:  #959595;
      --bevel-lo:  #292929;
      --text-gray: #B5B5B5;
      --blue-bar:  #000080;
      --blue-text: #FFFFFF;
      --green-on:  #468731;
      --playlist-bg: #000000;
      --bg1: var(--base-dark);
      --bg2: var(--bevel-lo);
      --card: var(--base-dark);
      --muted: var(--text-gray);
      --text: var(--text-gray);
      --accent: var(--blue-bar);
      --accent-2: var(--green-on);
      --danger: #ff0033;
      --warn: #ffaa00;
      --shadow: 0 0 8px rgba(0,0,0,0.7);
      --radius: 2px;
      --transition: 0.15s ease;
      --q-actions-w: 120px;
      --q-action-btn: 32px;
      --q-action-gap: 8px;
      --left-min: 260px;
      --left-max: 320px;
      --right-min: 260px;
      --right-max: 360px;
      --center-fr: 1.3fr;
      --inner-gap: 20px;
      --btn-bg: var(--base-dark);
      --btn-border: var(--bevel-hi);
      --btn-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 var(--bevel-lo);
      --btn-ring: rgba(0,0,128,0.35);
      --btn-radius: 2px;
      --btn-size: 50px;
      --btn-primary-size: 64px;
    }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: var(--btn-size); height: var(--btn-size); border-radius: var(--btn-radius); background: var(--base-dark); border: 1px solid var(--btn-border); color: var(--text-gray); box-shadow: var(--btn-shadow); cursor: pointer; transition: transform 120ms ease, background 120ms ease, opacity 120ms ease; user-select: none; -webkit-tap-highlight-color: transparent; }
    .btn.primary { width: var(--btn-primary-size); height: var(--btn-primary-size); background: var(--base-dark); border: 1px solid var(--btn-border); color: var(--text-gray); box-shadow: var(--btn-shadow); }
    .btn.dice { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.04); box-shadow: 0 6px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.02); }
    .btn.shuffle { background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid var(--btn-border); box-shadow: var(--btn-shadow); color: var(--text); display: inline-flex; align-items: center; justify-content: center; width: var(--btn-size); height: var(--btn-size); border-radius: var(--btn-radius); }
    .btn.compact { width: 36px; height: 36px; border-radius: 9px; font-size: 13px; }
    .btn:hover { transform: translateY(-1px); background: #474747; }
    .btn:active { transform: translateY(0) scale(0.98); background: rgb(48, 188, 255); box-shadow: inset 0 1px 0 var(--bevel-lo); }
    .btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--blue-bar); }
    .btn[disabled], .btn:disabled { opacity: 0.5; pointer-events: none; transform: none; box-shadow: none; }
    .btn > svg, .btn > i, .btn > img { width: 56%; height: 56%; display: block; object-fit: contain; }
    * { box-sizing: border-box; }

    /* --- BASE DESKTOP STYLES (ORIGINAL) --- */
    html, body {
        height: 100%;
        margin: 0;
        font-family: "Lucida Console", Monaco, monospace;
        color: var(--text);
        background: rgb(33, 33, 49);
        display: grid; /* Centers the player-shell on desktop */
        place-items: center; /* Centers the player-shell on desktop */
        padding: 24px;
     }
    .player-shell {
        display: grid; /* Added this from original CSS file */
        grid-template-columns: 200px 360px 1fr;
        grid-template-areas: "controls cover queue";
        gap: 14px;
        max-width: 1100px;
        padding: 16px;
        background: rgb(48, 47, 74);
        border: 1px solid var(--text-gray);
        box-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -2px 0 var(--bevel-lo);
        border-radius: 2px;
        max-height: 95vh; /* Added to prevent overflow on shorter screens */
    }
    .transport-card { grid-area: controls; padding: 14px; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: flex-start; background: rgb(45, 44, 69); border: 1px solid var(--text-gray); box-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 var(--bevel-lo); border-radius: 2px; }
    .cover-card { grid-area: cover; padding: 18px; display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: flex-start; background: rgb(45, 45, 69); border: 1px solid var(--text-gray); box-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 var(--bevel-lo); border-radius: 2px; color: var(--green-on); text-align: center; }
    .cover-card .cover { width: 320px; height: 320px; max-width: 100%; aspect-ratio: 1/1; border-radius: 4px; object-fit: cover; background: var(--playlist-bg); border: 1px solid var(--text-gray); box-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 var(--bevel-lo); }
    .cover-card .title, .cover-card .artist, .cover-card .album { color: var(--green-on); text-align: center; width: 100%; }
    .side-card { grid-area: queue; padding: 14px 18px; overflow: hidden; display: flex; flex-direction: column; gap: 12px; background: rgb(45, 45, 69); border: 1px solid var(--text-gray); box-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 var(--bevel-lo); border-radius: 2px; }
    .transport-card .controls { display: flex; flex-direction: row; gap: 10px; align-items: center; justify-content: center; width: 100%; flex-wrap: wrap; padding: 6px 0; }
    .transport-card .btn { width: 50px; height: 50px; border-radius: 8px; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; }
    .transport-card .btn.primary { width: 64px; height: 64px; font-size: 18px; }
    .transport-card .btn.dice { background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.05); }
    .side-card { display: flex; flex-direction: column; gap: 12px; padding: 14px 18px; }
    .queue-list { flex: 1 1 auto; overflow-y: auto; padding-right: 6px; background: var(--playlist-bg); }
    .qitem { display: grid; grid-template-columns: 40px 1fr var(--q-actions-w); gap: 12px; align-items: center; padding: 10px 8px; min-height: 56px; background: var(--playlist-bg); border-bottom: 1px solid var(--bevel-lo); color: var(--green-on); font-family: "Lucida Console", Monaco, monospace; }
    .qitem:hover { background: #0a0a0a; }
    .qitem.is-active, .qitem.active, .qitem.selected { background: var(--blue-bar); color: var(--blue-text); }
    .qitem .qi-title { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .qitem .btn { background: #1a1a1a; border: 1px solid var(--green-on); color: var(--green-on); box-shadow: inset 0 1px 0 rgba(0, 255, 0, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.5); }
    .qitem .btn:hover { background: #2a2a2a; border-color: var(--green-on); box-shadow: 0 0 4px var(--green-on); }
    .qitem .btn:active { background: var(--blue-bar); border-color: var(--blue-text); color: var(--blue-text); }
    /* --- END BASE DESKTOP STYLES --- */

    /* --- SMALLER SCREEN ADJUSTMENTS (Still applies to desktop tablets etc) --- */
    @media (max-width: 520px) {
        :root { --btn-size: 44px; --btn-primary-size: 56px; }
        .btn.compact { width: 30px; height: 30px; }
        .btn.shuffle { width: var(--btn-size); height: var(--btn-size); } /* Keep shuffle size consistent */
        .transport-card .btn { width: 44px; height: 44px; }
        .transport-card .btn.primary { width: 56px; height: 56px; }
        :root { --q-actions-w: 88px; --q-action-btn: 28px; }
        .qitem { grid-template-columns: 28px 1fr var(--q-actions-w); min-height: 52px; }
        /* Cover size adjustment only needed for mobile portrait */
        /* .cover-card .cover { width: 240px; height: 240px; } */
    }

    /* --- MOBILE PHONE STYLES (< 900px) --- */
    @media (max-width: 900px) {
      /* Override body centering and padding for mobile */
      html, body {
        display: block; /* Remove grid centering */
        height: 100%;
        overflow: hidden; /* Prevent body scroll */
        padding: 0; /* Remove desktop padding */
      }

      /* Make player shell full screen and stack vertically */
      .player-shell {
        grid-template-columns: 1fr; /* Single column */
        grid-template-areas: /* Stack elements */
          "cover"
          "controls"
          "queue";
        grid-template-rows: auto auto 1fr; /* Define rows: cover/controls auto height, queue fills rest */

        /* Fullscreen dimensions */
        width: 100%;
        height: 100%;
        min-height: 100%; /* Ensure it fills viewport */
        max-height: 100%; /* Ensure it fills viewport */
        border: none; /* Remove desktop border */
        border-radius: 0; /* Remove desktop radius */
        gap: 10px; /* Adjust gap for mobile */

        /* Add safe-area padding for notches/bars */
        padding-top: env(safe-area-inset-top, 10px);
        padding-right: env(safe-area-inset-right, 10px);
        padding-bottom: env(safe-area-inset-bottom, 10px);
        padding-left: env(safe-area-inset-left, 10px);
      }
      /* Center transport controls horizontally */
      .transport-card .controls { flex-direction: row; flex-wrap: wrap; justify-content: center; }
      /* Adjust cover size for mobile portrait */
      .cover-card .cover {
        width: 280px; /* Or adjust as needed */
        height: 280px; /* Or adjust as needed */
      }
       /* Ensure side-card (queue container) can shrink and fill its grid area */
      .side-card {
        min-height: 0; /* Allows shrinking */
        padding: 10px; /* Adjust padding for mobile */
        height: 100%; /* Force fill the grid row */
      }
       /* Ensure the inner queue list scrolls correctly */
      .queue { /* Target the inner div containing the list */
         flex: 1; /* Already set, but ensure it works with parent height */
         overflow-y: auto; /* Already set */
         /* Add touch scrolling momentum */
         -webkit-overflow-scrolling: touch;
      }
    }
    /* --- END MOBILE PHONE STYLES --- */

    /* Additional styles (unchanged) */
    .progress { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; width: 100%; }
    .time { font-size: 12px; color: var(--text-gray); }
    .seek { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; background: var(--bevel-lo); border-radius: 4px; outline: none; }
    .seek::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: var(--bevel-hi); border-radius: 50%; cursor: pointer; }
    .vol { margin-top: 10px; width: 100%; }
    .vol-row { display: flex; align-items: center; gap: 8px; }
    input[type="range"] { flex: 1; }
    /* .queue rule moved inside mobile media query for clarity */
    .search-box { margin-top: 10px; }
    .search-box input { width: 100%; padding: 8px; background: var(--playlist-bg); border: 1px solid var(--bevel-lo); color: var(--green-on); }
    .search-results { max-height: 200px; overflow-y: auto; background: #080808; border: 1px solid var(--bevel-lo); }
    .srow { display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 5px; cursor: pointer; color: var(--green-on); }
    .srow:hover { background: var(--blue-bar); color: var(--blue-text); }
    .srow img { width: 32px; height: 32px; }
    .config { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    .config .row { display: flex; gap: 8px; }
    .config input, .config button { padding: 8px; flex: 1; }
    .config button { cursor: pointer; background: var(--bevel-hi); border: 1px solid var(--bevel-lo); }
    .config .small { font-size: 11px; color: var(--text-gray); }
    .status-row { display: flex; justify-content: space-between; width: 100%; font-size: 12px; }
`;

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
                <button title="Play here" className="btn compact" onClick={() => onAction('play', index)}>▶️</button> {/* Added compact class */}
                <button title="Remove" className="btn compact" onClick={() => onAction('remove', index)}>✖️</button> {/* Added compact class */}
            </div>
        </div>
    );
}

export default function App() {
    const [state, setState] = useState(initialState);
    const [statusText, setStatusText] = useState('Initializing...');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [configForm, setConfigForm] = useState({ serverUrl: '', username: '', password: '' });
    const [searchResults, setSearchResults] = useState([]);
    const [scrobbledIds, setScrobbledIds] = useState(new Set()); // State to track scrobbled songs

    const commandInProgress = useRef(false);
    const stateRef = useRef(state);
    const prevIndexRef = useRef(state.currentIndex);
    const nowPlayingIdRef = useRef(null); // Ref to track the current "Now Playing" song ID

    useEffect(() => { stateRef.current = state; }, [state]);

    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Spinnaker&display=swap'; // Typo corrected: https:
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
        return () => { document.head.removeChild(fontLink); };
    }, []);

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

    const setupMediaSessionHandlers = useCallback((handleTransport, skipTo) => { // Added skipTo dependency
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
                } catch (e) { console.warn("Seekto handler not supported", e)} // Added logging

                try {
                    navigator.mediaSession.setActionHandler('seekbackward', (details) => { // Added details param
                        const currentState = stateRef.current;
                        const seekOffset = details.seekOffset || 10; // Use provided offset or default
                        const newPos = Math.max(0, currentState.position - seekOffset);
                        skipTo(currentState.currentIndex, newPos);
                    });
                } catch (e) { console.warn("Seekbackward handler not supported", e)} // Added logging

                try {
                    navigator.mediaSession.setActionHandler('seekforward', (details) => { // Added details param
                        const currentState = stateRef.current;
                        const track = currentState.playlist[currentState.currentIndex];
                        const maxPos = track?.duration || 0;
                         const seekOffset = details.seekOffset || 10; // Use provided offset or default
                        const newPos = Math.min(maxPos, currentState.position + seekOffset);
                        skipTo(currentState.currentIndex, newPos);
                    });
                } catch (e) { console.warn("Seekforward handler not supported", e)} // Added logging
            } catch (error) {
                console.error('Error setting up Media Session handlers:', error);
            }
        }
    }, []); // Removed skipTo from dependencies here, handleTransport uses it via closure

    // --- Core State Refresh Logic ---
    const refreshState = useCallback(async (forceUpdate = false) => {
        if (!isSessionValid()) return; // Added check
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
                const currentTrack = newPlaylist[status.currentIndex ?? 0]; // Used nullish coalescing
                const prevTrack = prevState.playlist[prevState.currentIndex];

                // --- SCROBBLE ID RESET LOGIC ---
                // Reset scrobbled state only if the track ID actually changes
                let newScrobbledIds = prevState.scrobbledIds; // Use existing state by default
                if (currentTrack?.id && prevTrack?.id !== currentTrack?.id) {
                    if (DEBUG()) console.log(`Track changed from ${prevTrack?.id} to ${currentTrack?.id}, resetting scrobble state.`);
                   // Intentionally NOT resetting scrobbledIds here, polling loop handles it
                }
                 // Reset endHandledForId only if the track ID changes
                const newEndHandledForId = currentTrack?.id !== prevTrack?.id ? null : prevState.endHandledForId;

                return {
                    ...prevState,
                    playing: status.playing,
                    currentIndex: status.currentIndex ?? 0, // Used nullish coalescing
                    position: status.position ?? 0, // Used nullish coalescing
                    gain: status.gain ?? 1, // Used nullish coalescing
                    playlist: newPlaylist,
                    lastStatusTs: Date.now(),
                    localTickStart: status.position ?? 0, // Used nullish coalescing
                    endHandledForId: newEndHandledForId,
                    // scrobbledIds: newScrobbledIds // Update scrobbledIds state
                };
            });

            setStatusText(status.playing ? '▶️ Playing' : '⏸️ Paused');
        } catch (e) {
            if (e.message === 'Authentication failed' || e.message === 'Not authenticated') {
                setIsAuthenticated(false);
                setStatusText('Session expired. Please log in again.');
                 clearSession(); // Ensure session is fully cleared
            } else {
                setStatusText(`Error: ${e.message}`);
            }
            console.error('Refresh failed:', e);
        }
    }, [/* Removed scrobbledIds dependency */]); // Removed dependency

     const skipTo = useCallback(async (index, offsetSec = 0) => {
        if (!isSessionValid()) return; // Added check
        const currentState = stateRef.current;
        // Ensure index is within bounds, considering potentially empty playlist
        index = Math.max(0, Math.min(index, Math.max(0, currentState.playlist.length - 1)));

        commandInProgress.current = true;
        setStatusText('Skipping...'); // Provide user feedback
        try {
            await callJukebox('skip', `&index=${index}&offset=${Math.max(0, Math.floor(offsetSec))}`);
             // Immediately update local state for responsiveness before full refresh
            setState(prev => ({
                ...prev,
                currentIndex: index,
                position: offsetSec,
                localTickStart: offsetSec, // Reset ticker base
                lastStatusTs: Date.now(), // Reset ticker base time
                endHandledForId: null, // Reset end handling on skip
             }));
            await refreshState(true); // Force refresh to get authoritative state
        } catch (e) {
             console.error('Skip failed:', e); // Log error specifically
             setStatusText(`Skip Error: ${e.message}`); // Show skip error
             // Consider attempting a refresh even on error to try and recover state
             await refreshState(true);
        } finally {
            commandInProgress.current = false;
        }
    }, [refreshState]); // Keep refreshState dependency


    const handleTransport = useCallback(async (action) => {
        if (!isSessionValid() && action !== 'addRandom') return; // Allow addRandom even if logged out initially

        const currentState = stateRef.current;
        commandInProgress.current = true;
        setStatusText('...'); // Indicate action in progress

        try {
            let needsRefresh = true; // Assume refresh is needed unless action handles it

            if (action === 'play-pause') {
                const cmd = currentState.playing ? 'stop' : 'start';
                await callJukebox(cmd);
                 // Optimistic UI update
                 setState(prev => ({ ...prev, playing: !prev.playing }));
                 setStatusText(!currentState.playing ? '▶️ Playing' : '⏸️ Paused'); // Update status immediately
                 needsRefresh = false; // Let polling handle the exact state sync
                 // Scrobble Now Playing immediately on play
                 if (!currentState.playing && currentState.playlist[currentState.currentIndex]) {
                      scrobble(currentState.playlist[currentState.currentIndex].id, false);
                      nowPlayingIdRef.current = currentState.playlist[currentState.currentIndex].id;
                 } else {
                     nowPlayingIdRef.current = null; // Clear now playing on pause/stop
                 }
            } else if (action === 'next') {
                // Handle skipping past the end of the playlist
                const nextIndex = currentState.currentIndex + 1;
                 if (nextIndex >= currentState.playlist.length) {
                     // Option 1: Stop playback (or loop based on repeat mode later)
                     await callJukebox('stop');
                     setState(prev => ({ ...prev, playing: false, position: 0 })); // Reset state
                     setStatusText('⏹️ End of Queue');
                     needsRefresh = false;
                     // Option 2: Wrap around (implement based on repeat mode)
                     // await skipTo(0, 0); // Requires skipTo to be passed or accessible
                 } else {
                    await skipTo(nextIndex, 0); // Use skipTo for consistency
                 }
                 needsRefresh = false; // skipTo handles its own refresh
            } else if (action === 'previous') {
                const restartThreshold = 3; // Seconds to consider restarting vs going back
                const restart = currentState.position > restartThreshold;
                let targetIndex = currentState.currentIndex;
                if (!restart) {
                    targetIndex = Math.max(0, currentState.currentIndex - 1);
                }
                 await skipTo(targetIndex, 0); // Use skipTo, always seek to 0 on previous/restart
                 needsRefresh = false; // skipTo handles its own refresh
            } else if (action === 'clear') {
                if (window.confirm('Clear the whole queue?')) { // Use window.confirm
                     await callJukebox('clear');
                     // Clear local state immediately
                     setState(prev => ({
                         ...initialState, // Reset most state
                         gain: prev.gain, // Keep volume
                         // Keep auth details if needed, or handle logout separately
                     }));
                     setStatusText('Queue Cleared');
                } else {
                    needsRefresh = false; // No action taken
                     commandInProgress.current = false; // Release lock early
                     return; // Exit early
                }
            } else if (action === 'shuffle') {
                await callJukebox('shuffle');
                setStatusText('🔀 Shuffled');
            } else if (action === 'stop') {
                await callJukebox('stop');
                 // Optimistic UI update
                setState(prev => ({ ...prev, playing: false, position: 0 })); // Reset position on stop
                setStatusText('⏹️ Stopped');
                needsRefresh = false; // Let polling handle state sync
                 nowPlayingIdRef.current = null; // Clear now playing
            } else if (action === 'addRandom') {
                if (!isSessionValid()) {
                     setStatusText("Please log in to add songs.");
                     needsRefresh = false;
                     commandInProgress.current = false;
                     return;
                 }
                setStatusText('🎲 Adding random...');
                const { randomSong } = await addRandomSong();
                setStatusText(`🎲 Added: ${randomSong.title}`);
                // Only auto-start if nothing was playing and queue was empty *before adding*
                if (!currentState.playing && currentState.playlist.length === 0) {
                     // Check state *after* adding
                    const newState = await callJukebox('get'); // Get updated state
                    if (newState.playlist?.entry?.length > 0 && !newState.status.playing) {
                         await callJukebox('start');
                         // Fetch final state after starting
                         await refreshState(true);
                         needsRefresh = false; // refreshState was called
                    }
                 }
            }

            if (needsRefresh) {
                await refreshState(true); // Force refresh for actions that modify state
                 // Update status text based on refreshed state only if not set above
                 // Example: setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
            }
        } catch (e) {
            setStatusText(`Action failed: ${e.message}`);
            console.error('Transport action failed:', e);
             // Attempt to refresh state even after failure
             try { await refreshState(true); } catch (refreshError) { console.error("Refresh after action failure also failed:", refreshError); }
        } finally {
            commandInProgress.current = false;
             // Set a timeout to clear temporary status messages like 'Added...'
             setTimeout(() => {
                 const currentStatus = statusTextRef.current; // Need a ref for statusText
                 if (currentStatus.startsWith('🎲') || currentStatus.startsWith('🔀') || currentStatus.startsWith('Skipping') || currentStatus.startsWith('⏹️')) {
                     setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
                 }
             }, 2000);
        }
    }, [refreshState, skipTo]); // Added skipTo


     // Need a ref for status text to use in setTimeout cleanup
     const statusTextRef = useRef(statusText);
     useEffect(() => {
         statusTextRef.current = statusText;
     }, [statusText]);


    const handleQueueAction = useCallback(async (action, index) => {
        if (!isSessionValid()) return;
        commandInProgress.current = true;
        setStatusText('...');
        try {
            if (action === 'play') {
                await skipTo(index, 0); // Use skipTo
            } else if (action === 'remove') {
                const trackToRemove = stateRef.current.playlist[index];
                if (!trackToRemove) return; // Index out of bounds

                await callJukebox('remove', `&index=${index}`);
                 setStatusText(`Removed: ${trackToRemove.title}`);

                // --- ADJUSTMENT LOGIC ---
                const currentState = stateRef.current;
                let needsStateCorrection = false;
                let newIndex = currentState.currentIndex;

                // Scenario 1: Removed the currently playing track
                if (index === currentState.currentIndex) {
                    needsStateCorrection = true;
                    // If it wasn't the last track, the server usually auto-plays the next (now at the same index)
                    // If it WAS the last track, playback might stop, or index might become invalid.
                    // We rely on refreshState to get the *actual* new index and playing state.
                    if (DEBUG()) console.log("Removed currently playing track.");

                // Scenario 2: Removed a track before the currently playing track
                } else if (index < currentState.currentIndex) {
                    needsStateCorrection = true;
                    newIndex = currentState.currentIndex - 1; // Adjust index locally
                    if (DEBUG()) console.log("Removed track before current. Adjusted index locally to:", newIndex);
                }

                // Optimistic UI update (remove item locally)
                setState(prev => ({
                    ...prev,
                    playlist: prev.playlist.filter((_, i) => i !== index),
                    currentIndex: needsStateCorrection ? newIndex : prev.currentIndex // Apply local index correction
                }));

                await refreshState(true); // Force refresh to get authoritative server state
            }
        } catch(e) {
            console.error('Queue action failed:', e);
            setStatusText(`Error: ${e.message}`);
             await refreshState(true); // Attempt refresh even on error
        } finally {
            commandInProgress.current = false;
             setTimeout(() => {
                 if (statusTextRef.current.startsWith('Removed:')) {
                    setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
                 }
             }, 2000);
        }
    }, [skipTo, refreshState]);

    // --- Effects & Listeners ---

     useEffect(() => {
        // Pass skipTo to the handler setup
        setupMediaSessionHandlers(handleTransport, skipTo);
    }, [setupMediaSessionHandlers, handleTransport, skipTo]); // Added skipTo

    useEffect(() => {
        const currentTrack = state.playlist[state.currentIndex];
        if (currentTrack) {
            updateMediaSession(currentTrack, state.position, state.playing);
        } else {
             // Clear media session if playlist is empty or index is invalid
             if ('mediaSession' in navigator) {
                 navigator.mediaSession.metadata = null;
                 navigator.mediaSession.playbackState = 'none';
                 try {
                    if ('setPositionState' in navigator.mediaSession) {
                        navigator.mediaSession.setPositionState(null);
                    }
                 } catch (e) {}
             }
        }
    }, [state.currentIndex, state.playlist, state.position, state.playing, updateMediaSession]);

    // Initialization - try to reconnect with saved credentials
    useEffect(() => {
        let mounted = true;

        async function init() { // Renamed for clarity
            try {
                const savedConfig = getConfig();
                if (savedConfig.username && savedConfig.serverUrl) { // Check serverUrl too
                    setConfigForm(prev => ({...prev, ...savedConfig, password: '' })); // Keep password empty
                    setStatusText('🔌 Reconnecting…');

                    const connected = await reconnect();

                    if (!mounted) return;

                    if (connected) {
                        setIsAuthenticated(true);
                        setStatusText('✅ Connected. Refreshing...');
                        await refreshState(true); // Force initial refresh

                        // Check state *after* refresh
                        const currentState = stateRef.current;
                        if (currentState.playlist.length === 0) {
                             setStatusText(' Queue empty. Adding random songs...');
                             // Add songs sequentially to avoid race conditions
                             try {
                                 await handleTransport('addRandom');
                                 // Add more if desired, maybe with small delays
                                 // await new Promise(resolve => setTimeout(resolve, 200));
                                 // await handleTransport('addRandom');
                             } catch (addError) {
                                 console.error("Error adding initial random songs:", addError);
                                 setStatusText("Error adding initial songs.");
                             }
                        } else {
                             setStatusText(currentState.playing ? '▶️ Playing' : '⏸️ Paused');
                        }
                    } else {
                        setIsAuthenticated(false);
                        setStatusText('⚠️ Reconnect failed. Please log in.');
                        clearSession(); // Ensure cleanup
                    }
                } else {
                    setStatusText('👋 Please log in');
                }
            } catch (e) {
                console.error("Initialization error:", e); // Log error
                if (mounted) {
                    setIsAuthenticated(false);
                    setStatusText('Login Required'); // Simpler message
                    clearSession(); // Ensure cleanup
                }
            }
        }

        init(); // Call the async function

        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Removed refreshState dependency, init should run once


    // Polling loop (and authoritative scrobble check)
    useEffect(() => {
        if (!isAuthenticated) return;

        let pollTimeoutId = null; // Use timeout for variable interval

         const poll = async () => {
             if (!isSessionValid()) { // Check auth before fetching
                setIsAuthenticated(false); // Update auth state
                setStatusText("Session expired. Please log in.");
                return; // Stop polling
             }
             try {
                await refreshState(false); // Use the non-forcing refresh

                 // --- SCROBBLE LOGIC ---
                 const currentState = stateRef.current; // Get latest state *after* refresh
                 const tr = currentState.playlist[currentState.currentIndex];

                 if (tr) { // Only proceed if there's a current track
                     const dur = Math.max(0, tr.duration || 0);
                     const pos = currentState.position; // Use authoritative position from refresh

                      // Reset scrobble status if track has changed *since last poll*
                     if (tr.id !== nowPlayingIdRef.current) {
                          if (DEBUG()) console.log(`Polling detected track change to ${tr.id}, resetting scrobble status for this track.`);
                          setScrobbledIds(prev => {
                              const newSet = new Set(prev);
                              // Keep track of scrobbled songs, but don't prevent scrobbling the *same song* if played again later.
                              // The check `!scrobbledIds.has(tr.id)` handles this.
                              return newSet;
                          });
                          // Update Now Playing via scrobble API if playing
                          if (currentState.playing) {
                              scrobble(tr.id, false);
                          }
                          nowPlayingIdRef.current = tr.id; // Update ref *after* potential scrobble call
                     }


                     // Check eligibility and if *this instance* hasn't been scrobbled
                     if (currentState.playing && dur > 30 && !scrobbledIds.has(tr.id)) {
                         const isHalfway = pos >= dur / 2;
                         const isFourMinutes = pos >= 240; // 4 minutes

                         if (isHalfway || isFourMinutes) {
                             if (DEBUG()) console.log(`Scrobbling (from poll): ${tr.title} (ID: ${tr.id})`);
                             await scrobble(tr.id, true); // true for a full scrobble

                             // Update scrobble state immediately after successful scrobble call
                             setScrobbledIds(prev => new Set(prev).add(tr.id));

                             // Update status temporarily
                              // statusTextRef check is handled in handleTransport cleanup
                             setStatusText(` L Scrobble Registered: ${tr.title}`);
                              setTimeout(() => {
                                 // Only revert if the status hasn't changed to something else
                                 if (statusTextRef.current.startsWith(` L Scrobble Registered:`)) {
                                      setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
                                 }
                             }, 3000);
                         }
                     }
                 } else {
                     // No track currently, ensure nowPlaying ref is cleared
                     nowPlayingIdRef.current = null;
                 }


             } catch (e) {
                console.error("Background poll refresh failed:", e);
                // Don't stop polling on transient errors, but log them
             } finally {
                 // Schedule next poll - adjust interval based on visibility?
                  const interval = document.hidden ? 10000 : 2000; // Longer interval when hidden
                  if (isSessionValid()) { // Only reschedule if still valid
                    pollTimeoutId = setTimeout(poll, interval);
                  }
             }
         };

        // Start the first poll
         pollTimeoutId = setTimeout(poll, 100); // Start polling shortly after auth


        return () => clearTimeout(pollTimeoutId); // Clear timeout on unmount/re-run
    }, [refreshState, isAuthenticated]); // Dependencies


    // Auto-remove finished songs logic (Improved)
    useEffect(() => {
         // This effect now ONLY relies on the change of currentIndex provided by refreshState
        const prevIndex = prevIndexRef.current; // Get the index *before* this render
        const currentIndex = state.currentIndex; // Get the index *for* this render

        // Check if the index has advanced.
        if (currentIndex > prevIndex && state.playlist.length > 0) {
             // Only auto-remove if not repeating the single track that just finished
             const finishedTrackIndex = prevIndex; // The track that just finished IS prevIndex
            const isRepeatingOne = state.repeatMode === 'one' && currentIndex === finishedTrackIndex; // Example check

            if (!isRepeatingOne) {
                (async () => {
                    // This assumes the server *correctly* advanced the index.
                    // We remove the track at prevIndex.
                    const indexToRemove = prevIndex;
                    const trackToRemove = state.playlist[indexToRemove]; // Get track info *before* potential removal

                    if (trackToRemove && indexToRemove < currentIndex) { // Sanity check: ensure index is valid and behind current
                         if (DEBUG()) console.log(`Auto-removing finished track at index ${indexToRemove}: ${trackToRemove.title}`);
                        try {
                            await callJukebox('remove', `&index=${indexToRemove}`);
                             // OPTIONAL: Optimistic UI update (can cause flicker if refresh is slow)
                             // setState(prev => ({
                             //     ...prev,
                             //     playlist: prev.playlist.filter((_, i) => i !== indexToRemove),
                              //    currentIndex: prev.currentIndex - 1 // Adjust current index if needed
                             // }));
                             await refreshState(true); // Get definite state after removal
                        } catch (e) {
                            console.error(`Failed to auto-remove finished song at index ${indexToRemove}:`, e);
                             await refreshState(true); // Refresh even on error
                        }
                     } else {
                         if (DEBUG()) console.log(`Skipping auto-remove: Invalid index (${indexToRemove}) or track data.`);
                     }
                })();
            } else {
                 if (DEBUG()) console.log("Skipping auto-remove due to repeat mode 'one'.");
            }
        }

        // Always update the prevIndexRef *after* the logic for the *next* render cycle
        prevIndexRef.current = currentIndex;

    }, [state.currentIndex, state.playlist, state.repeatMode, refreshState]); // Dependencies


    // "Now Playing" update effect - Simplified: Handled within polling loop


    // Position ticker (for UI visual update only) - Keep as is
    useEffect(() => {
        let tickIntervalId = null;

         const tick = () => {
             const currentState = stateRef.current; // Use ref for latest state
             // Only tick if the tab is visible, playing, and not seeking
             if (document.hidden || !currentState.playing || currentState.seeking) {
                 return;
             }

             const tr = currentState.playlist[currentState.currentIndex];
             const dur = Math.max(0, tr?.duration || 0);

             if (dur > 0) { // Only calculate if duration is known
                 // Calculate visual-only position based on last *authoritative* time + local delta
                 const dt = (Date.now() - currentState.lastStatusTs) / 1000;
                 const estimatedPos = currentState.localTickStart + dt;
                 const pos = Math.min(dur, Math.max(0, estimatedPos)); // Clamp position between 0 and duration

                 // Only update state if the position actually changed visually
                 if (Math.abs(pos - currentState.position) > 0.1) { // Threshold to avoid rapid updates
                     setState(prev => ({ ...prev, position: pos }));
                 }

                 // Check for track end based on local ticker (less reliable than server)
                 // This is primarily for immediate UI feedback before the server confirms the next track
                 if (pos >= dur && dur > 0 && !currentState.endHandledForId) {
                      if (DEBUG()) console.log(`Local ticker detected end for track ID: ${tr?.id}`);
                      // Mark that local end is handled to prevent repeats before server state update
                      setState(prev => ({ ...prev, endHandledForId: tr?.id }));
                      // OPTIONAL: Trigger handleTransport('next') optimistically?
                      // Be cautious: This might conflict with server-side auto-advance.
                      // handleTransport('next');
                 }
             }
         };

         // Start ticking immediately if playing
        if (state.playing && !state.seeking) {
           tickIntervalId = setInterval(tick, 500); // UI ticks every 500ms
        }


        return () => clearInterval(tickIntervalId); // Clear interval on cleanup
         // Rerun effect if playing state or seeking state changes
    }, [state.playing, state.seeking]);


    // Volume Change Handler
    const handleVolumeChange = useCallback(async (e) => {
        if (!isSessionValid()) return;
        const volumeValue = Number(e.target.value);
        const gain = Math.max(0, Math.min(1, volumeValue / 100));

        // Optimistic UI update
        setState(prev => ({ ...prev, gain }));

        // Debounce API call
        // Clear previous timeout if exists
        if (volumeTimeoutRef.current) {
            clearTimeout(volumeTimeoutRef.current);
        }
        // Set new timeout
        volumeTimeoutRef.current = setTimeout(async () => {
            try {
                await callJukebox('setGain', `&gain=${gain}`);
                 // Optional: Confirm with a refresh after a delay?
                 // setTimeout(() => refreshState(true), 500);
            } catch (e) {
                console.error('Set gain failed:', e);
                setStatusText(`Volume Error: ${e.message}`);
                // Revert UI? Or rely on next refresh?
                 await refreshState(true); // Refresh to get actual gain
            }
        }, 250); // Debounce time in ms

    }, [refreshState]); // Added refreshState dependency

     const volumeTimeoutRef = useRef(null); // Ref for debouncing volume


    // Seek Logic
    const handleSeekInput = useCallback((e) => {
        // Update UI immediately while dragging
        const seekPercentage = Number(e.target.value) / 1000;
        const currentState = stateRef.current;
        const tr = currentState.playlist[currentState.currentIndex];
        const dur = Math.max(0, tr?.duration || 0);
        const pos = seekPercentage * dur;

        setState(prev => ({
            ...prev,
            seeking: true, // Mark as seeking
            position: pos, // Update visual position immediately
        }));
    }, []);

    const handleSeekChange = useCallback(async (e) => {
        // Called when slider is released (mouse up)
        const seekPercentage = Number(e.target.value) / 1000;
        const currentState = stateRef.current;
        const tr = currentState.playlist[currentState.currentIndex];
        const dur = Math.max(0, tr?.duration || 0);
        const pos = seekPercentage * dur;

        setState(prev => ({ ...prev, seeking: false })); // Mark seeking as finished

        if (isSessionValid()) {
            await skipTo(currentState.currentIndex, pos); // Call skipTo to update server
        }
    }, [skipTo]);


    // Search Logic
    const searchTimeoutRef = useRef(null); // Ref for search debounce
    useEffect(() => {
        const q = searchQuery.trim();

        // Clear previous timeout if query changes
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (q.length >= 2 && isSessionValid()) {
            searchTimeoutRef.current = setTimeout(async () => {
                setStatusText(`🔍 Searching for "${q}"...`);
                try {
                    const results = await searchSongs(q);
                    setSearchResults(results);
                    setStatusText(results.length > 0 ? `🔍 Found ${results.length} results` : `🔍 No results for "${q}"`);
                     // Clear status after a few seconds
                     setTimeout(() => {
                         if (statusTextRef.current.startsWith('🔍')) {
                             setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
                         }
                     }, 2500);
                } catch (e) {
                    console.error('Search failed:', e);
                    setSearchResults([]);
                    setStatusText(`Search Error: ${e.message}`);
                }
            }, 300); // Debounce search API calls
        } else {
            setSearchResults([]); // Clear results if query is too short or not authenticated
        }

        // Cleanup function to clear timeout if component unmounts or query changes again
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]); // Rerun only when searchQuery changes

    const addSongFromSearch = useCallback(async (song) => { // Pass whole song object
        if (!isSessionValid()) return;
        commandInProgress.current = true;
        setStatusText(`➕ Adding: ${song.title}`);
        setSearchQuery(''); // Clear search input immediately
        setSearchResults([]); // Clear results immediately

        try {
             const currentState = stateRef.current; // Get state *before* adding
            await callJukebox('add', `&id=${encodeURIComponent(song.id)}`);

            // Only auto-start if nothing was playing and queue was empty *before adding*
            if (!currentState.playing && currentState.playlist.length === 0) {
                 await callJukebox('start');
                 await refreshState(true); // Get final state after starting
            } else {
                 await refreshState(true); // Just refresh state if already playing or queue wasn't empty
            }
             setStatusText(`✅ Added: ${song.title}`);
        } catch (e) {
            console.error('Add song failed:', e);
            setStatusText(`Error adding: ${e.message}`);
             await refreshState(true); // Attempt refresh
        } finally {
            commandInProgress.current = false;
             setTimeout(() => {
                 if (statusTextRef.current.startsWith('✅ Added:') || statusTextRef.current.startsWith('Error adding:')) {
                    setStatusText(stateRef.current.playing ? '▶️ Playing' : '⏸️ Paused');
                 }
             }, 2000);
        }
    }, [refreshState]);

    // Login Logic
    const handleConfigChange = useCallback((e) => {
        setConfigForm(f => ({ ...f, [e.target.id]: e.target.value }));
    }, []);

    const handleLogin = useCallback(async () => {
        const { serverUrl, username, password } = configForm;
        if (!username || !password) { setStatusText('⚠️ Please enter username and password'); return; }
        if (!serverUrl) { setStatusText('⚠️ Please enter Server URL'); return; } // Added check

        setStatusText('🔒 Logging in…');
        setIsAuthenticated(false); // Assume failure initially
        try {
            await authenticate(serverUrl.trim(), username.trim(), password); // Trim inputs
            // Auth successful
            setIsAuthenticated(true);
            setStatusText('✅ Login successful! Loading player…');
            await refreshState(true); // Force refresh after login

             // Check state *after* refresh
             const currentState = stateRef.current;
            if (currentState.playlist.length === 0) {
                 setStatusText('Queue empty. Adding random song...');
                 await handleTransport('addRandom'); // Add one song
            } else {
                 setStatusText(currentState.playing ? '▶️ Playing' : '⏸️ Paused');
            }
             setConfigForm(f => ({ ...f, password: '' })); // Clear password field
        } catch (e) {
            setIsAuthenticated(false);
            setStatusText(`❌ Login failed: ${e.message}`);
            console.error('Login error:', e);
             clearSession(); // Ensure cleanup on failure
        }
    }, [configForm, refreshState, handleTransport]);

    // --- Derived State ---
    const currentTrack = state.playlist[state.currentIndex];

    const seekValue = useMemo(() => {
        const tr = currentTrack; // Use already derived currentTrack
        const dur = Math.max(0, tr?.duration || 0);
        // Use state.position which is updated by both ticker and refreshState
        const pos = Math.max(0, Math.min(dur, state.position));
        // Calculate percentage based on current position and duration
        return dur > 0 ? Math.round((pos / dur) * 1000) : 0;
    }, [state.position, currentTrack]); // Depend on position and track

    // --- RENDER ---
    return (
        <>
            <style>{styles}</style>
            <div className="player-shell">
                <aside className="cover-card">
                    <img className="cover" alt="Album art" src={coverArtUrl(currentTrack?.coverArt, 500)} /> {/* Slightly smaller size */}
                    <div className="meta">
                        <div className="title">{currentTrack?.title || 'Nothing playing'}</div>
                        <div className="artist">{currentTrack?.artist || '—'}</div>
                        <div className="album">{currentTrack?.album || ''}&nbsp;</div> {/* Keep space for layout consistency */}
                    </div>
                </aside>

                <div className="transport-card">
                     <div className="status-row">
                        {/* Use a span for status text to prevent layout shifts */}
                        <span id="statusText" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '10px'}}>{statusText}</span>
                        <div className="small">Queue: <span id="queueCount">{state.playlist.length}</span></div>
                    </div>
                    <div className="controls">
                      <button className="btn" title="Previous" onClick={() => handleTransport('previous')} disabled={!isAuthenticated}>⏮</button>
                      <button className="btn primary" title="Play / Pause" onClick={() => handleTransport('play-pause')} disabled={!isAuthenticated || state.playlist.length === 0}>
                        {state.playing ? '⏸' : '▶'}
                      </button>
                      <button className="btn" title="Next" onClick={() => handleTransport('next')} disabled={!isAuthenticated}>⏭</button>
                      <button className="btn shuffle" title="Shuffle Playlist" onClick={() => handleTransport('shuffle')} disabled={!isAuthenticated}>🔀</button>
                      <button className="btn dice" title="Add Random Song" onClick={() => handleTransport('addRandom')} disabled={!isAuthenticated}>🎲</button>
                    </div>

                    <div className="progress">
                        <div className="time">{fmtTime(state.position)}</div>
                        <input
                            className="seek" type="range" min="0" max="1000"
                            value={state.seeking ? Math.round((state.position / (currentTrack?.duration || 1)) * 1000) : seekValue} // Directly use position while seeking
                            // style={seekFillStyle} // Style might be handled via CSS pseudo-elements if preferred
                            onInput={handleSeekInput} // Use onInput for immediate feedback
                            onChange={handleSeekChange} // Use onChange for final value on release
                            disabled={!isAuthenticated || !currentTrack}
                        />
                        <div className="time">{fmtTime(currentTrack?.duration || 0)}</div>
                    </div>

                    <div className="vol">
                        <div className="vol-row">
                            <div title="Volume">🔊</div>
                            <input
                                type="range" min="0" max="100"
                                value={Math.round(state.gain * 100)}
                                // style={volFillStyle} // Style might be handled via CSS
                                onChange={handleVolumeChange} // Continuous update okay for volume
                                disabled={!isAuthenticated}
                            />
                            <div className="volpct">{Math.round(state.gain * 100)}%</div>
                        </div>
                    </div>
                </div>

                <aside className="side-card">
                    <h3>Queue</h3>
                     {/* Ensure the container itself scrolls */}
                    <div className="queue" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {state.playlist.map((song, index) => (
                            <JukeboxQueueItem
                                key={song.id ? `${song.id}-${index}`: index} // More robust key for duplicates
                                song={song}
                                index={index}
                                currentIndex={state.currentIndex}
                                onAction={handleQueueAction}
                            />
                        ))}
                         {state.playlist.length === 0 && <div style={{textAlign: 'center', color: 'var(--muted)', padding: '20px'}}>Queue is empty</div>}
                    </div>

                    <div className="search-box">
                        <input
                            placeholder="Search songs to add…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            disabled={!isAuthenticated}
                            style={{ width: '100%' }} // Ensure input fills width
                        />
                         {/* Conditional rendering for search results */}
                        {searchResults.length > 0 && (
                            <div className="search-results">
                                {searchResults.map((song) => (
                                    <div key={song.id} className="srow" onClick={() => addSongFromSearch(song)}>
                                        <img src={coverArtUrl(song.coverArt, 40)} alt="" // Empty alt is okay for decorative
                                             onError={(e) => e.target.style.visibility='hidden'}/>
                                        <div className="s-meta">
                                            <div className="qi-title" style={{color: 'var(--green-on)'}}>{escapeHtml(song.title || 'Unknown')}</div>
                                            <div className="s-artist" style={{fontSize: '0.8em', color: 'var(--muted)'}}>{escapeHtml(song.artist || '')} • {escapeHtml(song.album || '')}</div>
                                        </div>
                                        <div style={{textAlign: 'right', color: 'var(--green-on)'}}>➕</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="config">
                        <div className="row">
                            <input id="serverUrl" placeholder="Server URL (e.g., http://host:port)" value={configForm.serverUrl || ''} onChange={handleConfigChange} disabled={isAuthenticated} style={{flex: 2}}/>
                            <input id="username" placeholder="Username" value={configForm.username || ''} onChange={handleConfigChange} disabled={isAuthenticated} style={{flex: 1}}/>
                            <input id="password" placeholder="Password" type="password" value={configForm.password || ''} onChange={handleConfigChange} onKeyPress={(e) => e.key === 'Enter' && !isAuthenticated && handleLogin()} disabled={isAuthenticated} style={{flex: 1}}/>
                            <button onClick={handleLogin} disabled={isAuthenticated} style={{flex: 0.5}}>
                                {isAuthenticated ? '✓' : 'Login'}
                            </button>
                        </div>
                        <div className="small">
                            {isAuthenticated
                                ? `✓ Connected to ${config.serverUrl} as ${config.username}`
                                : '💡 Tip: Leave Server URL empty for relative path (if using proxy).'}
                        </div>
                         {isAuthenticated && ( // Add a Logout button
                             <button onClick={() => { clearSession(); setIsAuthenticated(false); setStatusText("Logged out"); setState(initialState); }} style={{ padding: '5px', marginTop: '5px', background: 'var(--danger)', color: 'white', border: '1px solid black'}}>Logout</button>
                         )}
                    </div>
                </aside>
            </div>
        </>
    );
}
