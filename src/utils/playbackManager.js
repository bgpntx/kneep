/**
 * PlaybackStateManager — manages playback state persistence in localStorage
 * for scrobble catch-up when the browser tab is hidden/inactive.
 */
import { DEBUG, cacheKey } from '../api/subsonic.js';

export class PlaybackStateManager {
    constructor() {
        this.storageKey = cacheKey('playbackState');
        this.scrobbledKey = cacheKey('scrobbled');
    }

    saveState(state) {
        try {
            const saveData = {
                currentTrackId: state.currentTrack?.id,
                currentTrackTitle: state.currentTrack?.title,
                currentTrackDuration: state.currentTrack?.duration,
                currentIndex: state.currentIndex,
                position: state.position,
                playing: state.playing,
                timestamp: Date.now(),
                queueSnapshot: state.playlist.map(t => ({
                    id: t.id,
                    title: t.title,
                    duration: t.duration
                }))
            };
            localStorage.setItem(this.storageKey, JSON.stringify(saveData));
            if (DEBUG()) console.log('State saved to localStorage:', saveData);
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    loadState() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return null;
            const data = JSON.parse(stored);
            // Validate timestamp - discard if older than 24 hours
            if (data.timestamp && (Date.now() - data.timestamp) > 86400000) {
                localStorage.removeItem(this.storageKey);
                return null;
            }
            if (DEBUG()) console.log('State loaded from localStorage:', data);
            return data;
        } catch (e) {
            console.error('Failed to load state:', e);
            localStorage.removeItem(this.storageKey);
            return null;
        }
    }

    calculateMissedTracks(savedState, currentState) {
        if (!savedState || !savedState.playing) return [];

        const elapsed = (Date.now() - savedState.timestamp) / 1000;
        if (elapsed < 30) return [];

        if (DEBUG()) console.log(`Time elapsed since last save: ${elapsed.toFixed(0)}s`);

        const missedTracks = [];
        let remainingTime = elapsed;
        let checkIndex = savedState.currentIndex;
        let startPosition = savedState.position || 0;

        while (remainingTime > 0 && checkIndex < savedState.queueSnapshot.length) {
            const track = savedState.queueSnapshot[checkIndex];
            if (!track) break;

            const trackDuration = track.duration || 0;
            const timeLeftInTrack = trackDuration - startPosition;

            if (remainingTime >= timeLeftInTrack) {
                missedTracks.push({
                    id: track.id,
                    title: track.title,
                    duration: trackDuration,
                    playedTo: trackDuration
                });
                remainingTime -= timeLeftInTrack;
                checkIndex++;
                startPosition = 0;
            } else {
                missedTracks.push({
                    id: track.id,
                    title: track.title,
                    duration: trackDuration,
                    playedTo: startPosition + remainingTime
                });
                break;
            }
        }

        if (DEBUG() && missedTracks.length > 0) {
            console.log('Calculated missed tracks:', missedTracks);
        }

        return missedTracks;
    }

    getScrobbled() {
        try {
            const stored = localStorage.getItem(this.scrobbledKey);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (e) {
            localStorage.removeItem(this.scrobbledKey);
            return new Set();
        }
    }

    saveScrobbled(scrobbledIds) {
        try {
            localStorage.setItem(this.scrobbledKey, JSON.stringify([...scrobbledIds]));
        } catch (e) {
            console.error('Failed to save scrobbled IDs:', e);
        }
    }

    addScrobbled(id) {
        const scrobbled = this.getScrobbled();
        scrobbled.add(id);
        this.saveScrobbled(scrobbled);
        return scrobbled;
    }

    pruneScrobbled() {
        const scrobbled = this.getScrobbled();
        if (scrobbled.size > 100) {
            const arr = [...scrobbled];
            const keep = new Set(arr.slice(-100));
            this.saveScrobbled(keep);
            return keep;
        }
        return scrobbled;
    }
}
