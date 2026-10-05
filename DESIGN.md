---
name: 糖音機 Web UI
description: A streaming-player remote for one shared Discord listening session.
colors:
  shell: "#050506"
  panel: "#121214"
  panel-raised: "#1b1b1f"
  panel-well: "#26262b"
  hover-wash: "rgba(255, 255, 255, .06)"
  hover-wash-strong: "rgba(255, 255, 255, .1)"
  hairline: "rgba(255, 255, 255, .08)"
  hairline-strong: "rgba(255, 255, 255, .18)"
  switch-track: "#3a3a41"
  text-primary: "#f5f5f7"
  text-secondary: "#a3a3ad"
  text-tertiary: "#8a8a94"
  text-on-tint: "rgba(255, 255, 255, .72)"
  log-ink: "#cfcfd6"
  candy-pink: "#ff5c93"
  candy-pink-hover: "#ff7aa8"
  candy-pink-press: "#f0457f"
  candy-pink-wash: "rgba(255, 92, 147, .14)"
  candy-pink-line: "rgba(255, 92, 147, .45)"
  on-candy-pink: "#1a0710"
  live-green: "#3ddc97"
  amber-caution: "#f7b955"
  coral-danger: "#ff6b57"
  coral-danger-wash: "rgba(255, 107, 87, .13)"
  on-coral-danger: "#2a0702"
  offline-ground: "#2a110e"
  offline-ink: "#ffd9d3"
  offline-pill-ink: "#ffd2cb"
typography:
  display:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "clamp(28px, 1.6vw + 18px, 44px)"
    fontWeight: 800
    lineHeight: 1.18
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-.02em"
  title-lg:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-.015em"
  title:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-.015em"
  title-sm:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-.01em"
  empty-title:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "16px"
    fontWeight: 750
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  row-title:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.3
  label:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    lineHeight: 1
  meta:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
    fontFeature: "tnum"
  badge:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "9.5px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  mono:
    fontFamily: "Cascadia Mono, Cascadia Code, SFMono-Regular, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  thumb: "4px"
  row: "6px"
  control: "8px"
  panel: "10px"
  overlay: "12px"
  pill: "999px"
spacing:
  gutter: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  button-primary:
    backgroundColor: "{colors.candy-pink}"
    textColor: "{colors.on-candy-pink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.candy-pink-hover}"
  button-primary-active:
    backgroundColor: "{colors.candy-pink-press}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "42px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "42px"
  button-ghost-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.text-primary}"
  button-small:
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "32px"
  transport-play:
    backgroundColor: "{colors.text-primary}"
    textColor: "#0d0d0f"
    rounded: "{rounded.pill}"
    size: "44px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    size: "32px"
  icon-button-hover:
    backgroundColor: "{colors.hover-wash-strong}"
    textColor: "{colors.text-primary}"
  input-field:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "42px"
  input-field-hover:
    backgroundColor: "{colors.panel-well}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  nav-item-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.text-primary}"
  queue-row:
    backgroundColor: "transparent"
    typography: "{typography.row-title}"
    rounded: "{rounded.row}"
    padding: "6px 10px 6px 6px"
    height: "60px"
  queue-row-hover:
    backgroundColor: "{colors.hover-wash}"
  queue-row-selected:
    backgroundColor: "{colors.candy-pink-wash}"
  queue-section-title:
    textColor: "{colors.text-primary}"
  queue-now-row:
    backgroundColor: "transparent"
    typography: "{typography.row-title}"
    padding: "6px 12px 6px 6px"
    height: "60px"
  queue-now-row-playing:
    textColor: "{colors.candy-pink}"
  selection-bar:
    backgroundColor: "{colors.candy-pink-wash}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "0 6px 0 12px"
    height: "44px"
  cover-mosaic-tile:
    backgroundColor: "{colors.panel-well}"
    rounded: "{rounded.thumb}"
    size: "44px"
  cover-mosaic-header:
    backgroundColor: "{colors.panel-well}"
    rounded: "{rounded.row}"
    size: "120px"
  player-bar:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.text-primary}"
    padding: "0 16px"
    height: "88px"
  player-bar-tinted-meta:
    textColor: "{colors.text-on-tint}"
  mini-player:
    backgroundColor: "{colors.panel-well}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.panel}"
    padding: "0 6px 0 10px"
    height: "64px"
  player-sheet:
    backgroundColor: "{colors.panel-well}"
    textColor: "{colors.text-primary}"
    padding: "10px 24px 28px"
    height: "100dvh"
    width: "100vw"
  transport-play-sheet:
    backgroundColor: "{colors.text-primary}"
    textColor: "#0d0d0f"
    rounded: "{rounded.pill}"
    size: "64px"
  switch:
    backgroundColor: "{colors.switch-track}"
    rounded: "{rounded.pill}"
    width: "42px"
    height: "24px"
  switch-on:
    backgroundColor: "{colors.candy-pink}"
  offline-banner:
    backgroundColor: "{colors.offline-ground}"
    textColor: "{colors.offline-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px 8px 8px"
  toast:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.panel}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  toast-error:
    backgroundColor: "{colors.coral-danger}"
    textColor: "{colors.on-coral-danger}"
---

# Design System: 糖音機 Web UI

## Overview

**Creative North Star: "The Side-Window Player"**

糖音機 is built to the streaming-player standard: a near-black shell holding a small set of rounded dark panels, with a sidebar, a main stage, the 播放佇列 queue and a player bar that never leave the screen on desktop. On a phone the same world turns queue-first: the queue is the dashboard and the player shrinks to a floating mini card that opens a full-screen player. It is meant to be read at a glance from a second window or a phone during voice chat: cover, title, who asked for it, what comes next. Every page keeps one-click control of the shared session.

The world is quiet and dark so the cover art and the single candy-pink accent can carry it. Depth comes from tone (shell, panel, raised, well) instead of borders or shadows. Shadows appear only on things that float: the cover, dialogs, toasts, thumbs and the phone mini player. The cover's own colour is the one source of tint: blurred, it lights the dashboard stage and washes the player bar, the mini player and the phone player sheet. Controls follow the category's grammar: pill buttons, circular icon controls, a white circular play button, 4px rails that turn pink and grow a white thumb on hover, and rows whose index turns into a checkbox or play affordance on hover.

Motion is short and physical. Hovers take 150ms, state changes 250ms, page entries 320ms, and one 600ms settle is reserved for the track change. The penguin memes are the personality layer. They stand in wherever something is absent (missing cover art wherever cover art appears, an empty queue or list, offline, reconnecting) and ride along on toasts, but never decorate a control. The system explicitly replaces the earlier dark-violet card dashboard: no glowing card grid, and transport is never trapped inside one card.

**Key Characteristics:**
- Near-black shell with 10px-radius panels on 8px gutters; a persistent queue panel and a player on every page (an 88px docked bar on desktop, a 64px floating mini player on phones).
- One brand accent, candy pink, used only for state: active, selected, focus, scrub, and the primary pill.
- A white circular play button is the primary transport action, not pink.
- Figtree variable for Latin and numerals, with the system CJK stack for Traditional Chinese; tabular figures for all times and counts.
- Tonal layering instead of shadows; shadows only on floating objects.
- A signature track change: the cover leaves in the skip direction, the next one settles in from the other side, and the ambient backdrop crossfades. The phone player sheet runs the same move.
- The player takes the cover's colour: a blurred, saturated copy of the cover under a dark scrim, shown only while a track is loaded.

## Colors

A neutral near-black zinc ramp with one saturated candy pink and three status hues that never act as brand color.

### Primary
- **Candy Pink** (candy-pink): the only brand accent. Used for the primary pill (加入, confirm), active switches and checkboxes, the scrubbed or hovered progress and volume fill, the active nav icon, the active playlist name, the 正在播放 state (the stage line, and the queue's 正在播放 row title and equalizer while playing), active shuffle/repeat, the repeat-one badge, drop-insertion lines, the focus outline, and the text caret. Hover lightens it (candy-pink-hover) and press deepens it (candy-pink-press). Text on pink is always the near-black on-candy-pink, never white.
- **Pink Wash** (candy-pink-wash): the 14% tint behind selected queue rows, the selection bar that appears only while queue rows are selected, the new-row arrival flash, and the 3px focus halo on fields.

### Neutral
- **Shell Black** (shell): the page ground between panels and behind the player bar.
- **Panel Charcoal** (panel): every main container (sidebar, main, queue) and the sticky top bar.
- **Raised Graphite** (panel-raised): inputs, selects, dialogs, the reconnect card and empty cover art.
- **Well Graphite** (panel-well): thumbnail wells, mini art placeholders and row action buttons.
- **Hover Wash / Strong** (hover-wash, hover-wash-strong): translucent white overlays for row, nav and icon hover.
- **Hairlines** (hairline, hairline-strong): settings dividers, field strokes, the compact layout's nav-strip and queue separators, and secondary button outlines.
- **Text ramp** (text-primary, text-secondary, text-tertiary): titles and values, then meta and inactive controls, then placeholders and fine print. Rails use 22% white as the empty track.
- **Text on Tint** (text-on-tint): secondary text on any cover-tinted surface (the player bar with a track loaded, the mini player and the sheet): requester meta, times and the volume percentage. It derives from the foreground at 72% so it stays legible on whatever hue the cover brings, where neutral grey would muddy.
- **Switch Track** (switch-track): the off state of a switch; hover lifts it one step lighter.
- **Log Ink** (log-ink): monospace log text on the log well, a softer white than text-primary for long reading.

### Status
- **Live Green** (live-green): connection and local-only chips, the success state of the add button, and the saved-row flash.
- **Amber Caution** (amber-caution): redacted sensitive values in settings.
- **Coral Danger** (coral-danger): offline pill, error toasts, and danger buttons and icons, with coral-danger-wash behind danger hover.
- **Offline Ground / Ink** (offline-ground, offline-ink, offline-pill-ink): the dark coral offline banner ground and its pale coral text, and the pale coral status text inside the offline latency pill. Offline state only.

### Named Rules
**The One Pink Rule.** Candy pink marks state and the single primary action. It never fills a panel, a heading, or a large surface; the biggest pink areas are a pill button and the 14% selection wash.

**The White Play Rule.** The play/pause circle is white with near-black glyphs. Pink is never the transport's primary color.

**The Cover Tint Rule.** Apart from pink and the status hues, the only colour comes from the current cover. The bar, mini player and sheet take it through the shared ambient layer under a dark scrim, and nothing is tinted while idle. Never pick a fixed tint colour for the player.

**The Status Is Not Brand Rule.** Green, amber and coral appear only when they report something (connected, saved, sensitive, offline, error). They are never decoration.

## Typography

**Display Font:** Figtree variable (300–900, self-hosted latin and latin-ext subsets), falling back to Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Noto Sans TC
**Body Font:** the same stack
**Label/Mono Font:** Cascadia Mono / Cascadia Code / SFMono-Regular / Consolas, for logs and playlist source URLs only

**Character:** Figtree gives Latin titles and every numeral a round, friendly geometric voice. Traditional Chinese renders in the platform's CJK face. Weight does the hierarchy work: 800 for headings, 650–700 for rows and controls, 400 for meta.

### Hierarchy
- **Display** (800, clamp 28–44px, 1.18, -.025em): the now-playing track title only. A single line that marquees with an edge mask when it overflows. The playlist header uses the same voice a step down (clamp 26–40px).
- **Headline** (800, 26px, 1.2, -.02em): the page title in the top bar (22px at the icon-rail and compact widths). Swaps with a 6px rise on page change.
- **Title** (800, 20px, -.015em): the 播放佇列 queue heading.
- **Title large** (800, 22px, -.015em): dialog headings, and the page title at the icon-rail and compact widths.
- **Title small** (800, 18px, -.01em): the brand wordmark, settings and permission group headings, and the feature-placeholder and reconnect headings.
- **Section** (800, 15px, -.005em): the queue's 正在播放 and 接下來 headings. The phone sheet's 正在播放 caption uses 15px at 750.
- **Empty title** (750, 16px): the one-line heading of an empty state.
- **Body** (400, 15px, 1.45): the default text size. Settings descriptions run 13px at 1.5, and empty-state copy 14px at 1.6 within a max width of 300px.
- **Row title** (650, 15px, 1.3): queue, playlist and nav labels. Truncated with an ellipsis, never wrapped.
- **Label** (700, 14.5px): button labels; small buttons use 13px.
- **Meta** (400–650, 12.5–14px, tabular): durations, counts, times, latency and volume percentage.
- **Badge** (800, 9.5px, tabular): the single numeral in the pink repeat-one badge. It carries one digit only, never words.
- **Sheet track title** (800, 26px, -.02em): the phone player sheet uses the headline voice for the track title, over 15px requester meta.

### Named Rules
**The Tabular Time Rule.** Every duration, count, latency, timestamp and percentage uses tabular figures so values never jitter while they tick.

**The One-Line Row Rule.** Row titles and metadata stay on one line and truncate with an ellipsis. Only the now-playing title moves, and only when it overflows.

## Layout

The desktop shell is a CSS grid with columns for the sidebar (232px), main (fluid) and queue (400px), plus a full-width player bar row (88px). It fills the viewport with an 8px gutter on the top and sides and the bar flush at the bottom. The page body does not scroll; the main panel and the queue list scroll independently. The top bar is 72px and sticky. Pages pad 24px on the sides and 32px at the bottom. The dashboard centers its stage: the cover is min(560px, 50vh) square, with a 30px gap to the title block (max 680px).

Rhythm: 2px between rows, 8px between controls, 12px inside rows and toolbars, 16–24px around blocks, 36px between settings groups.

Responsive behavior:
- **≤1279px:** the queue narrows to 360px and the stage tightens.
- **≤1099px:** the sidebar folds into a 72px icon rail (labels become visually hidden, the mascot shrinks), the queue goes to 320px, and the page title drops to 22px.
- **Main as container:** the main panel is a size container named `main`. At ≤760px the playlist workbench stacks and its tabs become a horizontal scroller. At ≤620px setting rows become a single column.
- **≤860px (phone, queue-first):** the layout becomes one column and panels lose their radius. The sidebar becomes a top strip with pill nav where only the active label shows, closed by a hairline. The queue follows main in page flow behind a hairline top edge. The dashboard's stage is hidden, so the dashboard shows the queue directly. On every page the player is a floating 64px mini card inset 8px from the sides and bottom (plus the safe area): 44px art, title and requester, then play/pause and next at 40px, with a 2px progress line along its bottom edge. Page content reserves the card's height plus 20px, and toasts and the offline banner sit above it. Tapping the card opens the full-screen player sheet (see Components).
- **Desktop track button:** above 860px the player bar's art and title navigate to the dashboard instead of opening a sheet.
- **≤480px:** brand text hides and the nav aligns to the start.
- **Touch (hover: none):** row checkboxes and actions stay visible, durations move into the meta line, and the hover-only play overlay is removed.

## Elevation & Depth

The system is flat and tonally layered: shell (darkest) → panel → raised → well, with translucent white washes for interaction. Panels, rows and the bar never cast shadows. Shadows are reserved for objects that float above the plane, and they are always neutral black at large blur. Ambient light, not shadow, carries the cover's colour. On the dashboard stage the current cover is blurred 70px and saturated 1.35×, faded into the panel by a vertical gradient. The player bar, the phone mini player and the phone sheet use the same two-layer crossfading ambient: the whole cover squashed to fill the surface (100% by 100%), blurred 80px, saturated 1.8× and brightened .8×, under a 66% shell scrim (the open sheet deepens it to a 45%→72%→90% top-to-bottom scrim). It appears only while a track is loaded; when a track has no cover, the penguin stand-in is the source.

### Shadow Vocabulary
- **Cover lift** (`box-shadow: 0 26px 60px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.35)`): the playing cover. Paused, it relaxes to `0 14px 34px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.3)` and scales to .94.
- **Overlay** (`box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.35)`): dialogs and the reconnect card.
- **Toast** (`box-shadow: 0 16px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)`): toasts. The offline banner uses `0 12px 30px rgba(0,0,0,.45)`.
- **Mini player** (`box-shadow: 0 12px 30px rgba(0,0,0,.5)`): the floating phone mini player only. Opened as the sheet it drops the shadow and the radius, and its big cover takes the cover lift.
- **Object** (`box-shadow: 0 14px 34px rgba(0,0,0,.45)`): playlist cover tiles and sticker-style memes.
- **Thumb** (`box-shadow: 0 2px 6px rgba(0,0,0,.45)`): the white thumbs on progress and volume, and the switch knob (`0 1px 3px`).
- **Focus halo** (`box-shadow: 0 0 0 3px` pink wash): focused fields only.

### Named Rules
**The Flat Plane Rule.** Panels, rows and the docked player bar sit on the plane with no shadow and no border. Only floating objects (cover, dialog, toast, thumb, sticker) cast one. In the compact single column, stacked panels are separated by hairlines, and the player becomes a floating object: a borderless mini card with a 10px radius and a `0 12px 30px rgba(0,0,0,.5)` shadow.

## Shapes

The shape vocabulary is soft rectangles for content and full pills or circles for anything you press. Containers use 10px (panel). Dialogs and the reconnect card use 12px. Rows and hover fields use 6px, thumbnails 4px, the bar mini art 6px, the cover 8px, and sticker memes 12px. On desktop the player bar's top corners take the 10px panel radius and its bottom edge stays flush. The phone mini player is a full 10px card; the open sheet is square-cornered and full screen around an 8px cover. Playlist cover mosaics clip to their tile's radius (4px tab tiles, 6px header cover). Every button, text input, select and status chip is a pill (999px). Icon-only controls and the play button are circles. Settings inputs are the one exception: they use an 8px control radius so they sit flush in dense rows. Rails are 4px tall with fully rounded ends. Checkboxes are 18px with 4px (thumb) corners and a 2px stroke. Icons are inline 24-unit stroked SVG (2px stroke, round caps and joins) at 18–22px. The brand mark is a 36px pink rounded square holding three meter bars that animate while music plays.

## Components

### Buttons
Tactile pills that scale up slightly on hover and dip on press.
- **Shape:** full pill (999px), 42px tall with 20px horizontal padding. Small buttons are 32px tall with 14px padding.
- **Primary:** candy pink with the near-black on-pink text. Hover goes to the lighter pink and press to the deeper pink. Use it for the single primary action in a context (加入, dialog confirm).
- **Secondary:** transparent with a hairline-strong outline; the outline turns white on hover.
- **Ghost:** secondary text on transparent; hover adds the wash and white text.
- **Danger:** coral text and 40% coral outline; hover adds the coral wash.
- **Feedback:** hover scale 1.03, press scale .97 (70ms), disabled 40% opacity. The add button confirms success by turning green with a check that draws itself in 380ms. An invalid add shakes the field 6px.
- **Icon buttons:** 32px circles in secondary text. Hover brings a strong wash; press scales to .9.

### Transport
- **Play/pause:** a 44px white circle. The two halves of the play triangle morph into the pause bars over 360ms (CSS path `d`). Hover scales 1.07; press scales .92.
- **Shuffle / previous / next / repeat:** 36px circles in secondary text. Active shuffle/repeat turns pink with a 4px dot under the icon, and repeat-one adds a pink numeric badge. On hover the arrowheads and triangles nudge 1.5px in their direction of travel, and on press they kick 2–3px.
- **Progress rail:** a 4px rail at 22% white with a white fill. On hover, focus or scrub the fill turns pink and a 12px white thumb scales in. A transparent native range sits on top so dragging tracks the pointer 1:1, and elapsed time brightens while scrubbing.
- **Volume:** the same rail at 112px. The speaker's sound waves retract as the level drops.

### Inputs / Fields
- **Style:** raised graphite pill, 42px, 1px hairline stroke, 16px padding (42px left when a search icon leads). Placeholders use tertiary text and the caret is pink.
- **Focus:** the stroke turns pink with a 3px pink-wash halo, and a leading icon brightens to white.
- **Hover:** the stroke strengthens and the field drops to the well tone.
- **Disabled:** 50% opacity.
- **Switch:** a 42×24 pill that turns pink when on, with an 18px white knob sliding 18px.
- **Checkbox:** turns pink when checked, with a near-black check.

### Navigation
- **Sidebar list:** 44px rows on an 8px radius in secondary text with 22px icons at weight 650. Hover adds the wash. Active is an 8% white fill, white text and a pink icon.
- **Icon rail (≤1099px):** 52×48 icon-only targets.
- **Compact (≤860px):** pills in a top strip; only the active item shows its label.
- **Top bar:** the page title on the left, with a pill server select and a pill latency chip on the right (green dot, coral when offline).

### Queue and Track Rows
- **Structure:** grid of lead (28px) / thumb (44px, 4px radius) / title + requester / end column. Rows are 60px (56px in playlists), have a 6px radius and sit 2px apart.
- **States:** hover adds the wash. On hover the index turns into a checkbox, the thumb shows a dark play overlay, and the duration gives way to circular move/delete actions; the up and down arrows nudge 2px. Selected rows carry the pink wash.
- **Motion:** rows enter with a 6px rise staggered 30ms (capped at 8). New rows drop in with a pink-wash flash over 1.4s. Removals slide 20px right and fade. While dragging, a row fades to 40%, and a 2px pink line marks the drop slot.

### Queue Structure
- **正在播放:** the queue panel opens with the current track under a 正在播放 section heading: a 60px row of 44px thumb, title and requester, and an equalizer at the end. While playing, the title and equalizer turn pink and the equalizer animates; paused, the equalizer rests in tertiary text. The section is hidden while idle.
- **接下來:** a section heading over the upcoming rows, carrying the 全選 checkbox label (13px/650, secondary text) at its right. The 全選 control is hidden when the queue is empty.
- **Selection bar:** appears only while rows are selected: a 44px pink-wash strip with an 8px radius showing the count and a secondary-pill 加入播放清單 action. It rises in over 250ms.

### Playlist Covers
- **Mosaic:** a playlist's cover is a 2×2 mosaic of its first four distinct YouTube videos (the mqdefault thumbnails), a single cover when it has one to three, and the hue-hashed monogram when it has none. Images that fail to load leave their cell on the well tone.
- **Sizes:** 44px tab tiles (4px radius) and the 120px header cover (6px radius, object shadow), which drops to 88px in the compact layout.

### Now-Playing Stage (signature)
The cover sits centered over an ambient-light backdrop, with the display title, then a line with the state, requester and channel. A pink equalizer marks 正在播放. While playing, the cover is at full scale and a small tilted penguin sticker pops out at its bottom-right corner. When paused, the cover settles to .94.

**Track change:** the cover leaves 28px in the skip direction (170ms, ease-in) and then settles in from 44px on the opposite side (600ms, settle curve). Two ambient layers crossfade over 600ms once the next image has loaded, and the title block rises in with a 70ms stagger. With reduced motion the moves are dropped and only fades remain.

### Player Bar
- **Desktop:** an 88px bar spanning the shell, with the track (56px art, title, requester) left, five transport controls over the progress rail center, and stop plus volume right. With a track loaded it takes the cover tint (see Elevation & Depth), and its meta, times and volume percentage switch to text-on-tint. The track button navigates to the dashboard; its title underlines on hover.

### Mini Player and Player Sheet (phone)
- **Mini player:** the 64px floating card described in Layout, tinted by the cover, on every page. Its art, title and requester form one button that opens the sheet.
- **Player sheet:** a modal dialog labelled 正在播放 that fills the screen. A head row holds a collapse chevron (40px circle) and the 正在播放 caption. Below it sit the big cover (up to 420px, at most 46% of the viewport height, 8px radius, cover lift), then the 26px title and requester on the scrubber, the 4px progress rail with its thumb always shown and times at either end, five transport controls (48px icons, a 64px white play), and stop plus volume.
- **Motion:** the sheet slides up over 320ms (ease-out) and down over 250ms (ease-in). It follows the finger when pulled down and closes past 110px; otherwise it springs back over 250ms. The chevron, Esc and the system Back also close it.
- **Track change:** the big cover runs the stage's signature move (28px exit in the skip direction over 170ms, 44px settle from the other side over 600ms), and paused it relaxes to .94 with the resting cover shadow.

### Toasts and Overlays
- **Toast:** a white-on-dark inversion (text-primary background, panel text) with an 8px radius and 14px/650 text. It sits above the player bar, rises in, and has a 3px countdown bar at its base. Errors switch to coral. A meme thumbnail can lead the toast.
- **Offline banner:** an offline-ground pill with offline-ink text, a 45% coral hairline and a round meme avatar.
- **Dialog:** raised graphite with a 12px radius, hairline border, overlay shadow and 26px padding. It rises in over a 62% black backdrop.

### Empty States
A centered penguin meme (124px, 12px radius), then a white 16px/750 line and a short secondary sentence, held to 300px wide.

## Do's and Don'ts

### Do:
- **Do** keep the queue and the player present on every page; transport is reachable from anywhere (the docked bar on desktop, the mini player on phones).
- **Do** use candy pink only for state and the one primary action per context, with on-candy-pink text on top.
- **Do** build depth from the shell → panel → raised → well ramp, and reserve shadows for floating objects.
- **Do** make every pressable control a pill or a circle, and give it a press response (scale .9–.97, or a 2–3px glyph nudge in its direction).
- **Do** use tabular figures for every time, count and percentage.
- **Do** use penguin memes to fill absence: missing cover art wherever cover art appears (stage, rows, the 正在播放 row, the mini player and the sheet), empty lists, offline, reconnecting, toasts.
- **Do** tint the player only from the current cover through the shared ambient layer, with secondary text at text-on-tint.
- **Do** keep motion on the tokenized durations (150 / 250 / 320 / 600ms) and curves, and give every animation a reduced-motion path that keeps only fades.

### Don't:
- **Don't** return to the incumbent dashboard: no grid of glowing cards, and no transport trapped inside one card.
- **Don't** add borders or shadows to desktop panels, rows or the docked player bar; the only exceptions are the compact layout's hairline separators and the floating mini player's shadow.
- **Don't** introduce a second brand hue; green, amber and coral are status only.
- **Don't** make the play button pink, or put white text on pink.
- **Don't** wrap row titles; truncate them with an ellipsis.
- **Don't** use a meme to decorate a control. A meme may stand in for missing cover art wherever cover art appears, including inside the mini player's open-player button and the 正在播放 row, and may react beside content (stickers, toast avatars), but it is never a control's icon, badge or ornament.
