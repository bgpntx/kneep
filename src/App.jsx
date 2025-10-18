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
    if (!isSessionValid() || !id) { if (DEBUG()) console.log('Scrobble skipped: not authenticated or missing song ID.'); return; }
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
    @media (max-width: 520px) { :root { --btn-size: 44px; --btn-primary-size: 56px; } .btn.compact { width: 30px; height: 30px; } .btn.shuffle { width: var(--btn-size); height: var(--btn-size); } }
    .btn.flat { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); box-shadow: none; transform: none; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; font-family: "Lucida Console", Monaco, monospace; color: var(--text); background: rgb(33, 33, 49); display: grid; place-items: center; padding: 24px; }
    .player-shell { grid-template-columns: 200px 360px 1fr; grid-template-areas: "controls cover queue"; gap: 14px; max-width: 1100px; padding: 16px; background: rgb(48, 47, 74); border: 1px solid var(--text-gray); box-shadow: inset 0 1px 0 var(--bevel-hi), inset 0 -2px 0 var(--bevel-lo); border-radius: 2px; }
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
    @media (max-width: 520px) { .transport-card .btn { width: 44px; height: 44px; } .transport-card .btn.primary { width: 56px; height: 56px; } :root { --q-actions-w: 88px; --q-action-btn: 28px; } .qitem { grid-template-columns: 28px 1fr var(--q-actions-w); min-height: 52px; } .cover-card .cover { width: 240px; height: 240px; } }
    @media (max-width: 900px) { .player-shell { grid-template-columns: 1fr; grid-template-areas: "cover" "controls" "queue"; } .transport-card .controls { flex-direction: row; flex-wrap: wrap; justify-content: center; } .cover-card .cover { width: 280px; height: 280px; } }
    /* Additional styles from original App.css that might be needed */
    .progress { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; width: 100%; }
    .time { font-size: 12px; color: var(--text-gray); }
    .seek { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; background: var(--bevel-lo); border-radius: 4px; outline: none; }
    .seek::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: var(--bevel-hi); border-radius: 50%; cursor: pointer; }
    .vol { margin-top: 10px; width: 100%; }
    .vol-row { display: flex; align-items: center; gap: 8px; }
    input[type="range"] { flex: 1; }
    .queue { flex: 1; overflow-y: auto; background-color: var(--playlist-bg); border: 1px solid var(--bevel-lo); padding: 5px; }
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
        fontLink.href = 'https.googleapis.com/css2?family=Spinnaker&display=swap';
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

    // *** FIX 1: Add this effect to handle tab visibility ***
    useEffect(() => {
        const handleVisibilityChange = () => {
            // Check if the page is NOT hidden (i.e., it just became visible)
            if (document.hidden === false && isAuthenticated) {
                if (DEBUG()) console.log('Page became visible, forcing state refresh.');
                // Force a refresh, bypassing the 'commandInProgress' check
                // because the state is guaranteed to be stale.
                refreshState(true);
            }
        };

        // Add the event listener when the component mounts
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Clean up the event listener when the component unmounts
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshState, isAuthenticated]); // Add refreshState and isAuthenticated as dependencies

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
            // Only poll if the document is visible
            if (document.hidden === false) {
                 refreshState(false);
            }
        }, 2000);
        
        return () => clearInterval(pollInterval);
    }, [refreshState, isAuthenticated]);

    // *** FIX 2: UPDATED Auto-remove finished songs logic ***
    useEffect(() => {
        const prevIndex = prevIndexRef.current;
        const currentIndex = state.currentIndex;
        
        // Check if the index has advanced AND we are not in 'one' repeat mode
        if (currentIndex > prevIndex && state.repeatMode !== 'one' && state.playlist.length > 0) {
            
            (async () => {
                try {
                    // Create a list of all indexes that finished
                    const indexesToRemove = [];
                    for (let i = prevIndex; i < currentIndex; i++) {
                        indexesToRemove.push(i);
                    }
                    
                    if (indexesToRemove.length > 0) {
                        if (DEBUG()) console.log(`Auto-removing ${indexesToRemove.length} finished track(s).`);
                        
                        // We must remove them in REVERSE order
                        // to not mess up the indexes of the tracks still in the queue.
                        for (const index of indexesToRemove.reverse()) {
                            await callJukebox('remove', `&index=${index}`);
                        }
                        
                        // After all removals, do one final refresh to sync state
                        await refreshState(true);
                    }
                } catch (e) {
                    console.error('Failed to auto-remove finished song(s):', e);
                }
            })();
        }
        
        // Always update the prevIndexRef *after* the logic
        prevIndexRef.current = currentIndex;
        
    }, [state.currentIndex, state.repeatMode, state.playlist.length, refreshState]);

    // "Now Playing" update effect
    useEffect(() => {
        const currentTrack = state.playlist[state.currentIndex];
        if (state.playing && currentTrack && nowPlayingIdRef.current !== currentTrack.id) {
            scrobble(currentTrack.id, false); // false for "now playing"
            nowPlayingIdRef.current = currentTrack.id;
        }
        if (!state.playing) {
            nowPlayingIdRef.current = null;
        }
    }, [state.playing, state.currentIndex, state.playlist]);
    
    // Position ticker, auto-repeat, and scrobbling logic
    useEffect(() => {
        const tickInterval = setInterval(() => {
            const currentState = stateRef.current;
            if (!currentState.playing || currentState.seeking) {
                return;
            }

            const tr = currentState.playlist[currentState.currentIndex];
            const dur = Math.max(0, tr?.duration || 0);
            const dt = (Date.now() - currentState.lastStatusTs) / 1000;
            const pos = Math.min(dur, currentState.localTickStart + dt);

            // --- Full Scrobble Logic ---
            if (tr && dur > 30 && !scrobbledIds.has(tr.id)) {
                const isHalfway = pos >= dur / 2;
                const isFourMinutes = pos >= 240; // 4 minutes

                if (isHalfway || isFourMinutes) {
                    scrobble(tr.id, true); // true for a full scrobble
                    setScrobbledIds(prev => new Set(prev).add(tr.id));
                    setStatusText(`Scrobbled: ${tr.title}`);
                    setTimeout(() => {
                        const latestState = stateRef.current;
                        setStatusText(latestState.playing ? '▶️ Playing' : '⏸️ Paused');
                    }, 3000);
                }
            }
            
            setState(prev => {
                // If the song has changed, reset the scrobbled set for the new song
                if (prev.playlist[prev.currentIndex]?.id !== tr?.id) {
                    setScrobbledIds(new Set());
                }
                return { ...prev, position: pos };
            });
            
        }, 500);

        return () => clearInterval(tickInterval);
    }, [scrobbledIds]);

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
        const pos = (Number(e.taget.value) / 1000) * dur;
        
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
            setSearchResults([]);
            await refreshState(true);
        } catch (e) {
            console.error(e);
        } finally {
            commandInProgress.current = false;
        }
    }, [refreshState]);
    
    // Login Logic
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

    // --- Derived State ---
    const currentTrack = state.playlist[state.currentIndex];
    
    const seekValue = useMemo(() => {
        const tr = state.playlist[state.currentIndex];
        const dur = Math.max(0, tr?.duration || 0);
        const pos = Math.max(0, Math.min(dur, state.position));
        return dur ? Math.round((pos / dur) * 1000) : 0;
    }, [state.position, state.currentIndex, state.playlist]);
    
    const seekFillStyle = useMemo(() => ({'--seek-fill': `${(seekValue / 10).toFixed(1)}%`}), [seekValue]);
    const volFillStyle = useMemo(() => ({'--vol-fill': `${Math.round(state.gain * 100)}%`}), [state.gain]);

    // --- RENDER ---
    return (
        <>
            <style>{styles}</style>
            <div className="player-shell">
                <aside className="cover-card">
                    <img className="cover" alt="Album art" src={coverArtUrl(currentTrack?.coverArt, 900)} />
                    <div className="meta">
                        <div className="title">{currentTrack?.title || 'Nothing playing'}</div>
                        <div className="artist">{currentTrack?.artist || '—'}</div>
                        <div className="album">{currentTrack?.album || ''}&nbsp;</div>
                    </div>
                </aside>

                <div className="transport-card">
                     <div className="status-row">
                        <div id="statusText">{statusText}</div>
                        <div className="small">Queue: <span id="queueCount">{state.playlist.length}</span> tracks</div>
                    </div>
                    <div className="controls">
                      <button className="btn" title="Previous" onClick={() => handleTransport('previous')}>⏮</button>
                      <button className="btn primary" title="Play / Pause" onClick={() => handleTransport('play-pause')}>
                        {state.playing ? '⏸' : '▶'}
                      </button>
                      <button className="btn" title="Next" onClick={() => handleTransport('next')}>⏭</button>
                      <button className="btn shuffle" title="Shuffle" onClick={() => handleTransport('shuffle')}>🔀</button>
                      <button className="btn dice" title="Add random track" onClick={() => handleTransport('addRandom')}>🎲</button>
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
                    <h3>Queue</h3>
                    <div className="queue">
                        {state.playlist.map((song, index) => (
                            <JukeboxQueueItem 
                                key={song.id || index} song={song}
                                index={index} currentIndex={state.currentIndex}
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
                                    <img src={coverArtUrl(song.coverArt, 80)} alt="Cover" onError={(e) => e.target.style.visibility='hidden'}/>
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
                            <input id="serverUrl" placeholder="Server URL" value={configForm.serverUrl || ''} onChange={handleConfigChange} disabled={isAuthenticated}/>
                            <input id="username" placeholder="Username" value={configForm.username || ''} onChange={handleConfigChange} disabled={isAuthenticated} />
                            <input id="password" placeholder="Password" type="password" value={configForm.password || ''} onChange={handleConfigChange} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} disabled={isAuthenticated}/>
                            <button onClick={handleLogin} disabled={isAuthenticated}>
                                {isAuthenticated ? '✓ Logged In' : 'Login'}
                            </button>
                        </div>
                        <div className="small">
                            {isAuthenticated 
                                ? '✓ Connected. Your password is never stored.' 
                                : '💡 Tip: Leave Server URL empty if using the nginx proxy.'}
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
}
