# System.md — Unbound Music Architecture

## Project Purpose & Philosophy

**Unbound Music** is a zero-auth, zero-backend Progressive Web App (PWA) that streams free music powered by YouTube. It prioritizes user privacy, offline capability, and autonomy — no login required, no tracking, no ads.

- **User Control**: Full client-side execution. User data lives in their browser only.
- **Zero Dependencies**: No backend, no database, no third-party authentication.
- **Accessibility**: Works offline after first load. Installable on any device.

## Architecture Overview

### Frontend Stack
- **Framework**: React 18+ (Strict Mode)
- **Language**: TypeScript (Strict Mode enforced)
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight, no `react-router-dom`)
- **PWA**: `vite-plugin-pwa` for offline support and installation

### Data Model
- **Storage**: IndexedDB (primary) + localStorage (small metadata)
- **Music Source**: YouTube iframe API (no API key exposure to user)
- **Import**: Spotify (YourLibrary.json), YouTube (channel ID)

### Key Components
```
index.html (shell + inline styles + vanilla JS player)
├── Topbar (title, greeting, search/import icons)
├── Tab Strip (home, search, youtube, spotify, liked, downloads, queue, import)
├── Content Area (scrollable views)
├── Mini Player (fixed above bottom nav)
├── Full Player (fullscreen, queue panel)
├── Bottom Navigation (home, search, liked, youtube, import)
└── YouTube Player (hidden iframe)
```

### Authentication & Security
- **Zero Auth**: No user login, no session tokens.
- **API Key**: YouTube API key is embedded in `index.html` — **DO NOT expose in client code in production**. Consider using a proxy for production.
- **Data Privacy**: All user data (liked songs, queue, downloads) stored locally in IndexedDB.

## Coding Standards & Style Rules

### TypeScript
- **Strict Mode**: Always enabled. No `any` without justification.
- **Naming**: camelCase for variables/functions, PascalCase for types/classes.
- **Imports**: Use ES modules. Avoid circular dependencies.
- **Error Handling**: Wrap async operations in try-catch. Never let promises reject silently.

### React Component Conventions
- **Functional Components**: Only use functional components with hooks.
- **Hooks**: `useState`, `useContext`, `useEffect`, `useCallback`, `useMemo` as needed.
- **Props**: Destructure props at the function signature.
- **No Prop Drilling**: Use Context for global state (e.g., player state, liked songs).

### Code Organization
- `/src/components/` — Reusable UI components
- `/src/hooks/` — Custom hooks (usePlayer, useLikedSongs, etc.)
- `/src/utils/` — Utilities (time formatting, local storage helpers)
- `/src/types/` — Shared TypeScript types
- `/src/App.tsx` — Root component
- `/src/main.tsx` — Entry point

### CSS & Styling
- **Approach**: CSS Modules or inline styles (no Tailwind — keep bundle small for PWA).
- **Design Tokens**: Use CSS variables for colors, spacing, typography.
- **Mobile-First**: All layouts optimized for touch and mobile screens.
- **Accessibility**: Semantic HTML, ARIA labels, high contrast.

### Testing
- **Framework**: Vitest or Jest
- **Coverage**: Unit tests for utilities and hooks, component tests for complex logic.
- **No E2E in CI**: Avoid YouTube iframe testing in automated pipelines.

## UX & UI Principles

### Design Philosophy
- **Minimal & Dark**: Dark indigo background, vibrant accent colors (cyan, pink).
- **Mobile-Centric**: Touch-friendly buttons (min 44×44px), large hit areas.
- **Fast Feedback**: Instant UI updates; don't wait for network or player ready.
- **Gesture-Driven**: Swipe to close player, tap to play, long-press for context menu (future).

### Core Flows
1. **Discovery** → Home tab (trending, recent) → Play track
2. **Search** → Search tab → Search input → Results → Play
3. **Import** → Import tab → Upload Spotify JSON or enter YouTube Channel ID → Load library
4. **Playback** → Mini player (above nav) → Full player (swipe up)
5. **Curation** → Like/Unlike (❤️/🤍) → Download for offline (⬇️)

### Colors & Tokens
```
--ind:     #1A0A2E (Indigo, dark background)
--ind-m:   #2D1B4E (Indigo medium, cards)
--ind-l:   #3D2660 (Indigo light, borders)
--bb:      #7EC8E3 (Baby Blue, primary accent)
--pk:      #FF2D78 (Pink, secondary accent, active state)
--txt:     #F0E6FF (Text, light purple)
--muted:   #9B86BD (Muted, secondary text)
--card:    #231242 (Card background)
```

### Components & Patterns
- **Track Item**: Thumbnail + title + artist + action buttons (like, download)
- **Mini Player**: Floating bar above bottom nav with play/prev/next controls
- **Full Player**: Fullscreen with album art, progress bar, queue sidebar
- **Empty States**: Friendly icons + explanation text
- **Loading**: Spinner + message
- **Toasts**: Top-center notifications (2s auto-dismiss)

## Autonomy Rules & Constraints

### Copilot Directives
1. **Action-First**: Do not ask unnecessary questions. If a fix is safe and solves the stated problem, apply it.
2. **Type Safety First**: Every file edit must pass `npx tsc --noEmit` with zero errors before marking complete.
3. **No Hallucination**: Do not import or use libraries not in `package.json`.
4. **Scope Isolation**: Before editing, search the codebase to understand dependencies and impact.
5. **Testing Required**: After major changes, verify the app builds and runs.
6. **Read Context First**: Check `Context/` files before proposing architectural changes.
7. **Respect Compatibility**: Do not break API shapes or data models listed in `Compatibility.md`.

### Forbidden Actions
- **Never expose the API key** to the public or in version control commits.
- **Never use backend services** — all execution must be client-side.
- **Never add external analytics or tracking** — privacy is core.
- **Never use `react-router-dom`** — Wouter only.
- **Never remove TypeScript Strict Mode**.
- **Never deploy to production without testing offline mode**.

### Deployment Model
- **Personal-Only PWA**: Installed on Danny's devices only.
- **No Cloud Storage**: No user data sent to servers (except YouTube API calls).
- **No CI/CD Required**: Manual build and deploy to personal server.

## Personal Preferences (Danny)

- **Code Style**: Concise, readable, no over-engineering. Small utilities > large frameworks.
- **Performance**: Fast load, minimal bundle size. 100kB of JS is the hard limit.
- **Dark Mode**: Always. No light mode option.
- **Music Priority**: Playback quality > feature count. One solid player > ten broken features.
- **Privacy First**: User data never leaves the device.
- **Offline First**: App must work without internet after cache warms.

## Maintenance & Evolution

### Monthly Tasks
- Check for dependency updates (careful with major versions).
- Review offline cache hit rate in analytics (if future analytics added).
- Refresh API keys if they expire or leak.

### Quarterly Reviews
- User feedback on playback reliability.
- Performance profiling (bundle size, FCP, LCP).
- Accessibility audit (keyboard nav, screen reader).

### Deprecation Policy
- Old API versions: Support 2 versions back.
- Breaking changes: Document in `CoreChanges/`.
- Removed features: Add migration note in `CoreChanges/`.

---

**Last Updated**: 2026-09-27  
**Maintainer**: Danny (Zer0FuKsGiv3n)  
**Status**: Active Development
