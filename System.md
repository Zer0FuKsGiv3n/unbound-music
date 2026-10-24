# System.md — Unbound Music Architecture

This is the single source of truth for Unbound Music. If a future
partner, including Copilot or Muse, needs to pick this app up without
Daniel re-explaining everything, start here. This file replaces the
old `bootstrap.md` autonomous-bootstrap plan, which was audited on
2026-10-24 and dropped: its useful failsafe ideas are distilled below,
and its autonomous, self-merging loop is not used. See “Working model”
below.

## Project purpose & philosophy

**Unbound Music** is Daniel's personal music player. It is for him
alone, to enjoy without the ridiculousness of most streaming
services: no worry about money, and no constant barrage of ads.

- **Personal only.** Not a product, not monetised, not for distribution.
- **Free / ad-free from the app itself, forever.** The app must never
  charge, show its own ads, add a paywall, or add tracking.
- **Music as therapy.** Daniel listens any time he gets the chance.
  The app must let him search for a song, artist, playlist, or artist
  radio and effortlessly listen as long as he wants, without crashing
  his device.
- **Browser first.** Daniel mostly uses a Samsung Galaxy A16 5G on
  Metro by T-Mobile. The preference is a browser app (PWA); a
  full-stack app is only an option if it is actually needed for elite
  execution.
- **Original, not a clone.** Borrow proven mechanisms that work, never
  another app's identity. Do not settle for a Musify clone, and do not
  let the app become one by copying features for their own sake.
  Fall in love with what works.

## Working model — read this before any autonomous idea

- **Partner-led, not autonomous.** Daniel directs, the partner builds,
  Daniel approves, then a push to main happens. There is no
  self-generating task loop, no self-review, and no auto-merge.
- **Approval before push.** Work goes straight to main only after
  Daniel's approval for that push, subject to the normal write-approval
  tap. A general go-ahead does not bypass that tap.
- **Small, incremental steps.** One proven mechanism at a time, tested
  before the next. Do not grow the code exponentially to chase an idea.
- **Plain language.** Daniel is learning code syntax and lingo.
  Explain code in plain words, and explain unfamiliar terms.

## Architecture overview — as it actually is on main

### Frontend stack
- **Framework:** React 18, functional components with hooks
- **Language:** TypeScript, strict mode
- **Build tool:** Vite 5 (a Dependabot Vite 5 → 8 bump exists as a
  separate PR; test it alone, do not bundle it with features)
- **Routing:** Wouter
- **PWA:** `vite-plugin-pwa` for app-shell caching and installation

### Current state (main, 2026-10-24, after the magic-if push)
- Real YouTube IFrame playback, with play/pause sync, next/previous,
  ended advances to next, and plain errors for unavailable or
  non-embeddable videos.
- A compact, still-visible YouTube player dock above the mini player
  while playing. Audio-first UI, never hidden, never audio-ripped.
- Artist radio: a shuffled, de-duplicated queue, replenished when
  within 5 tracks of the end. Simulated radio, not official
  YouTube Radio.
- Search no longer wipes the playing or saved queue. Tapping a search
  result, opening a playlist, or starting radio changes the queue
  only on that explicit choice.
- Recommended for you on Home, with the “magic if”: one saved switch,
  External recommendations On/Off. Off is Unbound's own instant mix
  from liked, saved, and recent tracks. On is YouTube-style picks
  scored from recently played artists, with a fallback to the own mix.
  Search is untouched by that switch.
- Tabs: Home, Search, YouTube, Spotify, Liked, Saved, Queue, Radio,
  Import. Most of the app is still in `src/App.tsx`, with
  `src/lib/youtube.ts`, `src/lib/youtubePlayer.ts`,
  `src/lib/recommendations.ts`, `src/lib/storage.ts`, and
  `src/types.ts`. Splitting App.tsx into components/hooks is future
  work, not a current fact.

### Data model — as it actually is
- `Track { id, title, artist, thumb, source: 'youtube' | 'spotify' | 'local' }`
- `PlaylistItem { id, title, itemCount? }`
- Storage today is **localStorage**, not IndexedDB: `liked_songs`,
  `downloads`, `queue`, `yt_channel_id`, `yt_playlists`,
  `yt_subscriptions`, `external_recommendations`.
- “Downloads” / Saved today is a saved list, not a downloaded file.
  There is no offline audio cache yet. The PWA caches the app shell;
  do not claim offline listening works until it is actually tested.
- YouTube search today goes through a temporary Base44 proxy
  (`VITE_YOUTUBE_PROXY_URL` can override it). Base44 only helped go
  from thought to tangible; treat it as temporary scaffolding, not
  the foundation. Its exact replacement has not been chosen yet.
  Search, playlists, playlist items, and subscriptions are the proxy
  endpoints in use; there is no related-videos endpoint, which is why
  external recommendations are approximated with artist-radio search.

### Search and metadata — what is allowed
- **YouTube:** searchable and playable through official visible
  embeds. No ripping, no downloads, no hidden/background-only player,
  no ad stripping, no scraping or circumvention, no redistribution
  or monetisation. This is general information, not legal advice.
- **Spotify:** metadata/search only in Unbound's own player is the
  safe pattern discussed; full Spotify playback cannot be moved into
  Unbound's player, and cannot bypass Premium. No Spotify metadata
  source has been agreed or implemented yet — do not assume one.
- **Search experience to match:** one search box, automatic and
  instant, there or not, with a clear found / not-found result.
  Source toggles must not be a daily user task; they belong, at most,
  in a troubleshooting setting.
- **YouTube videos themselves are outside the app's control.** The
  app cannot guarantee YouTube itself never shows an ad on a specific
  creator video. Do not promise otherwise, and do not strip ads to
  try to fix it.

## Coding standards & style rules

- **TypeScript strict.** No `any` without justification. Every edit
  must pass `npx tsc --noEmit` with zero errors, and `npm run build`
  must pass, before marking work complete.
- **Naming:** camelCase for variables/functions, PascalCase for
  types/classes.
- **Imports:** ES modules. Avoid circular dependencies.
- **Error handling:** Wrap async work in try-catch where it matters.
  Do not let promises reject silently, and do not return a silent
  empty list where the user needs a loading/error distinction.
- **No hallucinated libraries.** Do not import or use a library that
  is not in `package.json`.
- **Scope isolation.** Before editing, search the codebase to
  understand dependencies and impact.
- **Bundle honesty.** The old “100 kB of JS is the hard limit” was an
  aspiration, not a fact: the build was 163.88 kB JS after the
  magic-if push. Keep the bundle lean and report its real size;
  do not block a working feature to chase 100 kB, and do not claim
  100 kB when the build says otherwise.
- **Mobile-first, dark, touch-friendly.** Dark indigo UI, large hit
  areas, semantic HTML and ARIA labels where they help. No light
  mode is required.

## UX & UI principles

- **Playback quality over feature count.** One solid player beats
  ten broken features.
- **Instant feedback.** Do not wait for network or player ready to
  update the UI where a local answer is available.
- **Queue honesty.** Recently Played is not just `queue.slice(0, 5)`
  by design, even though that is the current shortcut — note it as
  a known shortcut, not as true history, when it matters.
- **Core flows:** Discovery on Home → play; Search → results → play
  on explicit tap; Radio → artist seed → continuous queue;
  Like/Save → Liked/Saved lists; Import → YouTube channel ID today,
  Spotify `YourLibrary.json` import is still dead UI, not a working
  feature — do not present it as working.
- **Empty and error states:** Say plainly what is missing and what
  to do next, instead of showing a blank list.

## Compatibility and stability rules

Do not break, without an explicit decision from Daniel:
- The `Track` and `PlaylistItem` shapes above.
- The localStorage keys above.
- The queue rules: search and browsing never replace the queue;
  only an explicit tap, playlist open, or radio start does.
- The visible-player rule and the no-ripping / no-ad-stripping rules.
- Wouter routing. Do not switch to `react-router-dom` casually.
- TypeScript strict mode.

## Task template — use this shape when a real task needs it

Do not create empty template folders. When a task is real, write it
down in this shape, in the conversation or in a commit message:
- **Goal:** What Daniel will be able to do when this is done.
- **Constraints:** Free/ad-free from the app, legal visible embeds,
  approval before push, browser-first on the Galaxy A16.
- **Acceptance criteria:** What Daniel can check on his phone.
- **Test expectations:** `tsc --noEmit` clean, build passes, and the
  phone check above where it applies.
- **References:** This file, and the specific code being changed.

## Forbidden actions

- Never expose an API key or password in chat, in a commit, or in
  client code. Keys go through a secure flow, never in chat.
- Never add external analytics or tracking.
- Never hide the YouTube player, rip audio, download YouTube audio,
  or strip ads.
- Never charge, add a paywall, or add the app's own ads.
- Never remove TypeScript strict mode.
- Never turn on an autonomous loop, auto-review, or auto-merge.
- Never deploy or claim a deployment that has not been verified.
- Never present a dead UI (Spotify import today) as a working feature.

## Deployment model

- **Personal-only PWA.** Daniel's devices only.
- **No cloud storage of user data** except YouTube API calls through
  the temporary proxy above.
- **No CI/CD required.** Manual build and approval before push.

## Maintenance notes

- Check dependency updates carefully, especially major versions.
  Test the Vite 8 Dependabot PR alone.
- Do not claim analytics, offline-audio, or cache-hit data that does
  not exist. There is no analytics in the app today.
- Breaking changes: document them in the commit message and update
  this file in the same change, so this file does not go stale again.

---

**Last updated:** 2026-10-24
**Maintainer:** Daniel (Zer0FuKsGiv3n)
**Status:** Active development — partner-led, approval before push.
**Supersedes:** `bootstrap.md` (audited and removed 2026-10-24; its
failsafe ideas are distilled here, its autonomous loop is dropped.
Git history still holds the old file if it is ever needed for reference.)
