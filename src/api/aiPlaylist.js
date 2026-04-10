/**
 * AI playlist generation using Anthropic Claude API.
 * Sends a catalog of available tracks and gets back a curated 100-track playlist.
 */

const ANTHROPIC_PROXY = '/anthropic/';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_ARTISTS = 40;
const MAX_TRACKS_PER_ARTIST = 80;

/**
 * Build a compressed catalog string for the AI prompt.
 * Format: "Artist Name: Track1 | Track2 | Track3\n"
 */
function compressCatalog(catalog) {
    // Sort artists by track count descending, limit to MAX_ARTISTS
    const artists = Object.entries(catalog)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, MAX_ARTISTS);

    return artists.map(([artist, tracks]) => {
        const trackTitles = tracks
            .slice(0, MAX_TRACKS_PER_ARTIST)
            .map(t => t.title)
            .join(' | ');
        return `${artist}: ${trackTitles}`;
    }).join('\n');
}

/**
 * Parse AI response to extract [{artist, title}] array.
 */
function parseAiResponse(text) {
    // Try to extract JSON from markdown code fences or raw text
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

    // Find the JSON array in the string
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('No JSON array found in AI response');

    return JSON.parse(arrayMatch[0]);
}

/**
 * Match AI-suggested tracks back to Navidrome track IDs.
 */
function matchTracksToIds(suggestions, catalog) {
    const matched = [];

    for (const { artist, title } of suggestions) {
        if (!artist || !title) continue;
        const normalizedArtist = artist.toLowerCase().replace(/^the\s+/, '');
        const normalizedTitle = title.toLowerCase();

        // Search across all catalog artists for a match
        for (const [catArtist, tracks] of Object.entries(catalog)) {
            const catArtistNorm = catArtist.toLowerCase().replace(/^the\s+/, '');
            if (catArtistNorm !== normalizedArtist &&
                !catArtistNorm.includes(normalizedArtist) &&
                !normalizedArtist.includes(catArtistNorm)) continue;

            const match = tracks.find(t => {
                const tNorm = t.title.toLowerCase();
                return tNorm === normalizedTitle ||
                    tNorm.includes(normalizedTitle) ||
                    normalizedTitle.includes(tNorm);
            });

            if (match && !matched.some(m => m.id === match.id)) {
                matched.push(match);
                break;
            }
        }
    }

    return matched;
}

/**
 * Fill remaining slots with random tracks from the catalog.
 */
function fillWithRandom(matched, catalog, target = 100) {
    if (matched.length >= target) return matched.slice(0, target);

    const usedIds = new Set(matched.map(t => t.id));
    const allTracks = Object.values(catalog).flat().filter(t => !usedIds.has(t.id));

    // Shuffle and pick
    for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
    }

    const fill = allTracks.slice(0, target - matched.length);
    return [...matched, ...fill];
}

/**
 * Generate an AI-curated playlist from a catalog of available tracks.
 * @param {Object} catalog - { "Artist Name": [{id, title, album, duration}, ...], ... }
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Array>} - Array of track objects with Navidrome IDs
 */
export async function generateAiPlaylist(catalog, apiKey) {
    const compressedCatalog = compressCatalog(catalog);

    const totalArtists = Object.keys(catalog).length;
    const totalTracks = Object.values(catalog).reduce((sum, t) => sum + t.length, 0);

    const res = await fetch(`${ANTHROPIC_PROXY}v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 8192,
            messages: [{
                role: 'user',
                content: `You are a music DJ creating a playlist for a listening session. Below is a catalog of ${totalTracks} available tracks from ${totalArtists} artists in the user's music library.

Pick exactly 100 tracks and order them for a great listening experience. Rules:
- Mix artists throughout — avoid clustering tracks from the same artist
- Create a natural energy flow (build up, peak, cool down, etc.)
- Prioritize variety while keeping cohesion
- Only pick tracks from the catalog below

CATALOG:
${compressedCatalog}

Return ONLY a JSON array of 100 objects: [{"artist": "...", "title": "..."}, ...]. No explanation.`
            }],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    const suggestions = parseAiResponse(text);
    const matched = matchTracksToIds(suggestions, catalog);
    return fillWithRandom(matched, catalog, 100);
}
