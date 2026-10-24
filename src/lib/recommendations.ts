import type { Track } from '../types';
import { fetchArtistRadioTracks } from './youtube';

function shuffleTracks(tracks: Track[]): Track[] {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i] as Track;
    shuffled[i] = shuffled[j] as Track;
    shuffled[j] = temp;
  }
  return shuffled;
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const unique: Track[] = [];
  for (const track of tracks) {
    if (!seen.has(track.id)) {
      seen.add(track.id);
      unique.push(track);
    }
  }
  return unique;
}

/**
 * Unbound's own recommendations: a shuffled, de-duplicated mix drawn
 * only from what the listener has already liked, saved, or played
 * recently in this app. No network call, so this is instant.
 */
export function getOwnRecommendations(
  liked: Track[],
  saved: Track[],
  recent: Track[],
  count = 15,
): Track[] {
  return shuffleTracks(dedupeTracks([...liked, ...saved, ...recent])).slice(0, count);
}

/**
 * External-style recommendations, translated from Musify's approach.
 *
 * Musify's version calls YouTube's related-videos list for each recent
 * seed song and scores results by position and recency. Unbound's proxy
 * has no related-videos endpoint, only search, so the translation uses
 * artist-radio search for each seed artist instead, then keeps Musify's
 * scoring idea: earlier results and more recent seeds score higher.
 */
export async function getExternalRecommendations(
  recent: Track[],
  excludeIds: ReadonlySet<string> = new Set(),
  count = 15,
): Promise<Track[]> {
  const seeds = recent.slice(0, 5);
  if (seeds.length === 0) {
    return [];
  }

  const scores = new Map<string, number>();
  const byId = new Map<string, Track>();
  const seen = new Set<string>(excludeIds);

  const batches = await Promise.all(
    seeds.map(async (seed) => fetchArtistRadioTracks(seed.artist, seen)),
  );

  batches.forEach((batch, seedIndex) => {
    const recencyWeight = 1 - seedIndex / seeds.length;
    batch.slice(0, 8).forEach((track, i) => {
      const positionWeight = 1 - i / 8;
      const score = positionWeight * recencyWeight;
      scores.set(track.id, (scores.get(track.id) ?? 0) + score);
      if (!byId.has(track.id)) {
        byId.set(track.id, track);
      }
    });
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([id]) => byId.get(id))
    .filter((track): track is Track => track !== undefined);
}

/**
 * The magic "if", translated from Musify to Unbound's React/web idiom.
 *
 * In Musify (Dart) it is roughly:
 *   if (externalRecommendations.value && recentlyPlayed.isNotEmpty)
 *     return external recommendations
 *   return own mixed recommendations
 *
 * Here the same fork, in plain TypeScript. Search is untouched by this
 * switch, and tapping a recommendation only changes the queue on that
 * explicit tap, just like tapping a search result.
 */
export async function getRecommendedTracks(args: {
  externalRecommendations: boolean;
  liked: Track[];
  saved: Track[];
  recent: Track[];
  excludeIds?: ReadonlySet<string>;
}): Promise<Track[]> {
  if (args.externalRecommendations && args.recent.length > 0) {
    const external = await getExternalRecommendations(args.recent, args.excludeIds);
    if (external.length > 0) {
      return external;
    }
    // If the external path comes back empty, fall back to the own mix
    // rather than showing a blank list.
  }
  return getOwnRecommendations(args.liked, args.saved, args.recent);
}
