/**
 * Last.fm API client for fetching user listening history.
 * Uses nginx proxy (/lastfm/) to avoid CORS/CSP issues.
 */

const LASTFM_PROXY = '/lastfm/';

export async function getTopArtists(username, apiKey, minPlaycount = 500) {
    const allArtists = [];
    let page = 1;
    const limit = 500;

    while (true) {
        const params = new URLSearchParams({
            method: 'user.getTopArtists',
            user: username,
            api_key: apiKey,
            format: 'json',
            limit: String(limit),
            page: String(page),
            period: 'overall',
        });

        const res = await fetch(`${LASTFM_PROXY}?${params}`);
        if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);

        const data = await res.json();
        if (data.error) throw new Error(`Last.fm: ${data.message}`);

        const artists = data.topartists?.artist || [];
        if (artists.length === 0) break;

        for (const a of artists) {
            const playcount = parseInt(a.playcount, 10);
            if (playcount >= minPlaycount) {
                allArtists.push({ name: a.name, playcount });
            } else {
                // Artists are sorted by playcount desc, so we can stop
                return allArtists;
            }
        }

        // If we got fewer than limit, there are no more pages
        if (artists.length < limit) break;
        page++;
    }

    return allArtists;
}
