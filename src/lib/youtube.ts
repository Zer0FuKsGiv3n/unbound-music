import type { PlaylistItem, Track } from '../types';

const DEFAULT_PROXY = 'https://superagent-4f645ca0.base44.app/functions/ytProxy';
const proxyUrl = import.meta.env.VITE_YOUTUBE_PROXY_URL ?? DEFAULT_PROXY;

const toTrack = (item: {
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
}): Track | null => {
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

export async function fetchSearchResults(query: string): Promise<Track[]> {
  const response = await fetch(`${proxyUrl}?endpoint=search&part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=25`);
  if (!response.ok) return [];

  const data = await response.json() as { items?: Array<Record<string, unknown>> };
  return (data.items ?? [])
    .map((item) => toTrack(item as {
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
    }))
    .filter((track): track is Track => track !== null);
}

export async function fetchTrending(): Promise<Track[]> {
  const q = ['top hits 2025', 'trending music 2025', 'new releases 2025'][Math.floor(Math.random() * 3)];
  return fetchSearchResults(q);
}

export async function fetchUserPlaylists(channelId: string): Promise<PlaylistItem[]> {
  const response = await fetch(`${proxyUrl}?endpoint=playlists&part=snippet,contentDetails&channelId=${encodeURIComponent(channelId)}&maxResults=50`);
  if (!response.ok) return [];

  const data = await response.json() as { items?: Array<{ id?: string; snippet?: { title?: string }; contentDetails?: { itemCount?: number } }> };
  return (data.items ?? []).filter((item) => item.id).map((item) => ({
    id: item.id ?? '',
    title: item.snippet?.title ?? 'Untitled playlist',
    itemCount: item.contentDetails?.itemCount,
  }));
}

export async function fetchPlaylistTracks(playlistId: string, title: string): Promise<Track[]> {
  const response = await fetch(`${proxyUrl}?endpoint=playlistItems&part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=50`);
  if (!response.ok) return [];

  const data = await response.json() as {
    items?: Array<{
      snippet?: {
        resourceId?: { videoId?: string };
        title?: string;
        videoOwnerChannelTitle?: string;
        thumbnails?: { medium?: { url?: string } };
      };
    }>;
  };
  return (data.items ?? [])
    .map((item) => {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) return null;
      return {
        id: videoId,
        title: item.snippet?.title ?? title,
        artist: item.snippet?.videoOwnerChannelTitle ?? 'YouTube',
        thumb: item.snippet?.thumbnails?.medium?.url ?? '',
        source: 'youtube' as const,
      };
    })
    .filter((track): track is Track => track !== null);
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
