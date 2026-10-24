import type { PlaylistItem, Track } from '../types';

const DEFAULT_PROXY = 'https://superagent-4f645ca0.base44.app/functions/ytProxy';
const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL ?? DEFAULT_PROXY;

type YouTubeItem = {
  id?: { videoId?: string } | string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    videoOwnerChannelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      default?: { url?: string };
    };
    resourceId?: { videoId?: string };
  };
};

const toTrack = (item: YouTubeItem): Track | null => {
  const id = typeof item.id === 'string' ? item.id : item.id?.videoId ?? item.snippet?.resourceId?.videoId;
  if (!id) return null;

  const title = item.snippet?.title ?? 'Untitled track';
  const artist = item.snippet?.channelTitle ?? item.snippet?.videoOwnerChannelTitle ?? 'Unknown artist';
  const thumb = item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '';

  return {
    id,
    title,
    artist,
    thumb,
    source: 'youtube',
  };
};

const filterTracks = (track: Track | null): track is Track => track !== null;

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

/**
 * Simulated artist radio, built only from YouTube search.
 *
 * This is deliberately not presented as official YouTube Radio: there is
 * no radio endpoint in the proxy, so radio is a continuous, shuffled
 * queue seeded by an artist, de-duplicated against tracks already heard,
 * and replenished as it plays. It does not download anything, strip ads,
 * or hide the player — playback still goes through the visible IFrame.
 */
export async function fetchArtistRadioTracks(
  artist: string,
  excludeIds: ReadonlySet<string> = new Set(),
): Promise<Track[]> {
  const seed = artist.trim();
  if (!seed) {
    return [];
  }

  const queries = [`${seed} music`, `${seed} songs`, `${seed} official video`];
  const seen = new Set<string>(excludeIds);
  const collected: Track[] = [];

  for (const query of queries) {
    const results = await fetchSearchResults(query);
    for (const track of results) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        collected.push(track);
      }
    }
    // One good search is enough to start radio; extra queries are only
    // for replenishment depth, so stop early when we have a solid queue.
    if (collected.length >= 20) {
      break;
    }
  }

  return shuffleTracks(collected);
}

export async function fetchSearchResults(query: string): Promise<Track[]> {
  const response = await fetch(`${proxyUrl}?endpoint=search&part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=25`);
  if (!response.ok) return [];

  const data = await response.json() as { items?: YouTubeItem[] };
  return (data.items ?? []).map(toTrack).filter(filterTracks);
}

export async function fetchTrending(): Promise<Track[]> {
  const q = ['top hits 2025', 'trending music 2025', 'new releases 2025'][Math.floor(Math.random() * 3)];
  return fetchSearchResults(q);
}

export async function fetchUserPlaylists(channelId: string): Promise<PlaylistItem[]> {
  const response = await fetch(`${proxyUrl}?endpoint=playlists&part=snippet,contentDetails&channelId=${encodeURIComponent(channelId)}&maxResults=50`);
  if (!response.ok) return [];

  const data = await response.json() as { items?: Array<{ id?: string; snippet?: { title?: string }; contentDetails?: { itemCount?: number } }> };
  return (data.items ?? []).filter((item): item is typeof item & { id: string } => item.id != null).map((item) => ({
    id: item.id,
    title: item.snippet?.title ?? 'Untitled playlist',
    itemCount: item.contentDetails?.itemCount,
  }));
}

type PlaylistItem_ = {
  snippet?: {
    resourceId?: { videoId?: string };
    title?: string;
    videoOwnerChannelTitle?: string;
    thumbnails?: { medium?: { url?: string } };
  };
};

const playlistItemToTrack = (item: PlaylistItem_, fallbackTitle: string): Track | null => {
  const videoId = item.snippet?.resourceId?.videoId;
  if (!videoId) return null;
  return {
    id: videoId,
    title: item.snippet?.title ?? fallbackTitle,
    artist: item.snippet?.videoOwnerChannelTitle ?? 'YouTube',
    thumb: item.snippet?.thumbnails?.medium?.url ?? '',
    source: 'youtube',
  };
};

export async function fetchPlaylistTracks(playlistId: string, title: string): Promise<Track[]> {
  const response = await fetch(`${proxyUrl}?endpoint=playlistItems&part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=50`);
  if (!response.ok) return [];

  const data = await response.json() as { items?: PlaylistItem_[] };
  return (data.items ?? []).map((item) => playlistItemToTrack(item, title)).filter(filterTracks);
}

export async function fetchSubscriptions(channelId: string): Promise<Track[]> {
  const response = await fetch(`${proxyUrl}?endpoint=subscriptions&part=snippet&channelId=${encodeURIComponent(channelId)}&maxResults=50`);
  if (!response.ok) return [];

  const data = await response.json() as { items?: Array<{ snippet?: { title?: string; channelId?: string; thumbnails?: { medium?: { url?: string } } } }> };
  return (data.items ?? []).map((item) => ({
    id: item.snippet?.channelId ?? `subscription-${Math.random().toString(16).slice(2)}`,
    title: item.snippet?.title ?? 'Subscription',
    artist: 'YouTube channel',
    thumb: item.snippet?.thumbnails?.medium?.url ?? '',
    source: 'youtube',
  }));
}
