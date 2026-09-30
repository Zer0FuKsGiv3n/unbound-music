import { useEffect, useMemo, useState } from 'react';
import { Route, Switch } from 'wouter';
import { loadFromStorage, saveToStorage } from './lib/storage';
import { fetchSearchResults, fetchTrending, fetchPlaylistTracks, fetchSubscriptions, fetchUserPlaylists } from './lib/youtube';
import type { PlaylistItem, TabKey, Track } from './types';

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'search', label: 'Search', icon: '🔍' },
  { key: 'youtube', label: 'YouTube', icon: '▶️' },
  { key: 'spotify', label: 'Spotify', icon: '💚' },
  { key: 'liked', label: 'Liked', icon: '❤️' },
  { key: 'downloads', label: 'Saved', icon: '⬇️' },
  { key: 'queue', label: 'Queue', icon: '🎶' },
  { key: 'import', label: 'Import', icon: '📥' },
];

const defaultTrending = [
  {
    id: 'trending-1',
    title: 'Midnight Drive',
    artist: 'Velvet Harbor',
    thumb: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    source: 'youtube',
  },
  {
    id: 'trending-2',
    title: 'Neon Echoes',
    artist: 'Luna Circuit',
    thumb: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80',
    source: 'youtube',
  },
  {
    id: 'trending-3',
    title: 'Afterglow',
    artist: 'Morning Static',
    thumb: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
    source: 'youtube',
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [trending, setTrending] = useState<Track[]>(defaultTrending);
  const [liked, setLiked] = useState<Track[]>(() => loadFromStorage<Track[]>('liked_songs', []));
  const [downloads, setDownloads] = useState<Track[]>(() => loadFromStorage<Track[]>('downloads', []));
  const [queue, setQueue] = useState<Track[]>(() => loadFromStorage<Track[]>('queue', []));
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [channelId, setChannelId] = useState<string>(() => loadFromStorage<string>('yt_channel_id', ''));
  const [playlists, setPlaylists] = useState<PlaylistItem[]>(() => loadFromStorage<PlaylistItem[]>('yt_playlists', []));
  const [subscriptions, setSubscriptions] = useState<Track[]>(() => loadFromStorage<Track[]>('yt_subscriptions', []));

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    void loadTrendingTracks();
  }, []);

  useEffect(() => {
    saveToStorage('liked_songs', liked);
  }, [liked]);

  useEffect(() => {
    saveToStorage('downloads', downloads);
  }, [downloads]);

  useEffect(() => {
    saveToStorage('queue', queue);
  }, [queue]);

  useEffect(() => {
    saveToStorage('yt_channel_id', channelId);
  }, [channelId]);

  useEffect(() => {
    saveToStorage('yt_playlists', playlists);
  }, [playlists]);

  useEffect(() => {
    saveToStorage('yt_subscriptions', subscriptions);
  }, [subscriptions]);

  const loadTrendingTracks = async (): Promise<void> => {
    const results = await fetchTrending();
    if (results.length > 0) {
      setTrending(results);
    }
  };

  const handleSearch = async (): Promise<void> => {
    const query = searchTerm.trim();
    if (!query) return;
    setActiveTab('search');
    const results = await fetchSearchResults(query);
    setSearchResults(results);
    setQueue(results);
  };

  const loadYouTubeData = async (): Promise<void> => {
    if (!channelId.trim()) return;
    const [playlistData, subscriptionData] = await Promise.all([
      fetchUserPlaylists(channelId),
      fetchSubscriptions(channelId),
    ]);
    setPlaylists(playlistData);
    setSubscriptions(subscriptionData);
  };

  const openPlaylist = async (playlistId: string, title: string): Promise<void> => {
    const tracks = await fetchPlaylistTracks(playlistId, title);
    setQueue(tracks);
    setActiveTab('youtube');
  };

  const toggleLike = (track: Track): void => {
    setLiked((current) => {
      const exists = current.some((item) => item.id === track.id);
      if (exists) return current.filter((item) => item.id !== track.id);
      return [track, ...current];
    });
  };

  const saveTrack = (track: Track): void => {
    setDownloads((current) => {
      const exists = current.some((item) => item.id === track.id);
      if (exists) return current;
      return [track, ...current];
    });
  };

  const playTrack = (track: Track, sourceList?: Track[]): void => {
    setCurrentTrack(track);
    setQueue((current) => (sourceList && sourceList.length > 0 ? sourceList : current));
    setPlaying(true);
  };

  const playNext = (): void => {
    if (!currentTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % queue.length : 0;
    setCurrentTrack(queue[nextIndex] ?? currentTrack);
  };

  const playPrevious = (): void => {
    if (!currentTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    setCurrentTrack(queue[prevIndex] ?? currentTrack);
  };

  const playFromList = (track: Track, list: Track[]): void => {
    setQueue(list);
    setCurrentTrack(track);
    setPlaying(true);
  };

  const isLiked = (track: Track): boolean => liked.some((item) => item.id === track.id);
  const isDownloaded = (track: Track): boolean => downloads.some((item) => item.id === track.id);

  const renderTrackList = (items: Track[], listKey: string): JSX.Element => {
    if (items.length === 0) {
      return (
        <div className="empty-state">
          <div className="emoji">🎵</div>
          <p>No tracks here yet.</p>
        </div>
      );
    }

    return (
      <div className="track-list">
        {items.map((track) => (
          <div key={`${listKey}-${track.id}`} className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}>
            <img src={track.thumb} alt={track.title} className="track-thumb" />
            <div className="track-copy" onClick={() => playFromList(track, items)}>
              <div className="track-title">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
            </div>
            <div className="track-actions">
              <button type="button" className="mini-button" onClick={() => toggleLike(track)} aria-label="Toggle like">
                {isLiked(track) ? '❤️' : '🤍'}
              </button>
              <button type="button" className="mini-button" onClick={() => saveTrack(track)} aria-label="Save track">
                {isDownloaded(track) ? '✅' : '⬇️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">Unbound Music</div>
          <div className="greeting">{greeting}</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-button" onClick={() => setActiveTab('search')}>🔍</button>
          <button type="button" className="icon-button" onClick={() => setActiveTab('import')}>📥</button>
        </div>
      </header>

      <nav className="tab-strip" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="content-area">
        <Switch>
          <Route path="/">
            <section className="panel">
              <div className="section-header">
                <h2>🔥 Trending</h2>
                <button type="button" className="link-button" onClick={() => void loadTrendingTracks()}>Refresh</button>
              </div>
              {renderTrackList(trending, 'trending')}
            </section>

            <section className="panel">
              <h2>🕐 Recently Played</h2>
              {renderTrackList(queue.slice(0, 5), 'recent')}
            </section>
          </Route>

          <Route path="/search">
            <section className="panel">
              <div className="search-box">
                <input
                  type="search"
                  value={searchTerm}
                  placeholder="Search songs or artists"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleSearch();
                    }
                  }}
                />
                <button type="button" className="primary-button" onClick={() => void handleSearch()}>Search</button>
              </div>
              {searchResults.length > 0 ? renderTrackList(searchResults, 'search-results') : <div className="empty-state"><div className="emoji">🔎</div><p>Search for your next obsession.</p></div>}
            </section>
          </Route>

          <Route path="/youtube">
            <section className="panel">
              <div className="section-header">
                <h2>📼 Saved playlists</h2>
                <button type="button" className="link-button" onClick={() => void loadYouTubeData()}>Refresh</button>
              </div>
              {playlists.length > 0 ? (
                <div className="chip-list">
                  {playlists.map((playlist) => (
                    <button key={playlist.id} type="button" className="chip" onClick={() => void openPlaylist(playlist.id, playlist.title)}>
                      {playlist.title}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><div className="emoji">📋</div><p>Import a channel ID to load playlists.</p></div>
              )}
              <div className="spacer" />
              <h2>📡 Subscriptions</h2>
              {subscriptions.length > 0 ? renderTrackList(subscriptions, 'subscriptions') : <div className="empty-state"><div className="emoji">📡</div><p>Nothing imported yet.</p></div>}
            </section>
          </Route>

          <Route path="/spotify">
            <section className="panel">
              <div className="spotify-card">
                <div className="emoji large">💚</div>
                <h2>Spotify import</h2>
                <p>Upload your YourLibrary.json export to build a local music library with no login required.</p>
                <button type="button" className="primary-button wide">Upload JSON</button>
              </div>
            </section>
          </Route>

          <Route path="/liked">
            <section className="panel">
              <h2>❤️ Liked Songs</h2>
              {renderTrackList(liked, 'liked')}
            </section>
          </Route>

          <Route path="/downloads">
            <section className="panel">
              <h2>⬇️ Saved</h2>
              {renderTrackList(downloads, 'downloads')}
            </section>
          </Route>

          <Route path="/queue">
            <section className="panel">
              <div className="section-header">
                <h2>🎶 Up next</h2>
                <button type="button" className="link-button" onClick={() => setQueue([])}>Clear</button>
              </div>
              {renderTrackList(queue, 'queue')}
            </section>
          </Route>

          <Route path="/import">
            <section className="panel">
              <h2>📥 Import</h2>
              <div className="import-card">
                <label htmlFor="channel-input">YouTube Channel ID</label>
                <input
                  id="channel-input"
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxxxx"
                />
                <button type="button" className="primary-button" onClick={() => void loadYouTubeData()}>Load YouTube data</button>
              </div>

              <div className="import-card">
                <h3>Spotify library</h3>
                <p>Drop your YourLibrary.json export from spotify.com/account/privacy.</p>
                <button type="button" className="primary-button wide">Upload YourLibrary.json</button>
              </div>
            </section>
          </Route>
        </Switch>
      </main>

      <div className={`player-bar ${currentTrack ? 'visible' : ''}`} onClick={() => currentTrack && setActiveTab('queue')}>
        <img src={currentTrack?.thumb ?? ''} alt={currentTrack?.title ?? 'Track art'} className="player-art" />
        <div className="player-copy">
          <div className="player-title">{currentTrack?.title ?? 'Nothing playing'}</div>
          <div className="player-artist">{currentTrack?.artist ?? 'Choose a track'}</div>
        </div>
        <div className="player-actions">
          <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); playPrevious(); }}>⏮</button>
          <button type="button" className="mini-button primary" onClick={(event) => { event.stopPropagation(); setPlaying((value) => !value); }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); playNext(); }}>⏭</button>
        </div>
      </div>
    </div>
  );
}

export default App;
