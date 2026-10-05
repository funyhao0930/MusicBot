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
  text-primary: "#f5f5f7"
  text-secondary: "#a3a3ad"
  text-tertiary: "#8a8a94"
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
  title:
    fontFamily: "Figtree, Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Microsoft JhengHei, Noto Sans TC, Noto Sans CJK TC, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-.015em"
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
  player-bar:
    backgroundColor: "{colors.shell}"
    height: "88px"
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

糖音機 is built to the streaming-player standard: a near-black shell holding a small set of rounded dark panels, with a sidebar, a main stage, the 播放佇列 queue and a full-width player bar that never leave the screen. It is meant to be read at a glance from a second window or a phone during voice chat: cover, title, who asked for it, what comes next. Every page keeps one-click control of the shared session.

The world is quiet and dark so the cover art and the single candy-pink accent can carry it. Depth comes from tone (shell, panel, raised, well) instead of borders or shadows. Shadows appear only on things that float: the cover, dialogs, toasts and thumbs. Controls follow the category's grammar: pill buttons, circular icon controls, a white circular play button, 4px rails that turn pink and grow a white thumb on hover, and rows whose index turns into a checkbox or play affordance on hover.

Motion is short and physical. Hovers take 150ms, state changes 250ms, page entries 320ms, and one 600ms settle is reserved for the track change. The penguin memes are the personality layer. They stand in wherever something is absent (no cover, empty queue or list, offline, reconnecting) and ride along on toasts, but never decorate a control. The system explicitly replaces the earlier dark-violet card dashboard: no glowing card grid, and transport is never trapped inside one card.

**Key Characteristics:**
- Near-black shell with 10px-radius panels on 8px gutters; a persistent queue panel and an 88px player bar on every page.
- One brand accent, candy pink, used only for state: active, selected, focus, scrub, and the primary pill.
- A white circular play button is the primary transport action, not pink.
- Figtree variable for Latin and numerals, with the system CJK stack for Traditional Chinese; tabular figures for all times and counts.
- Tonal layering instead of shadows; shadows only on floating objects.
- A signature track change: the cover leaves in the skip direction, the next one settles in from the other side, and the ambient backdrop crossfades.

## Colors

A neutral near-black zinc ramp with one saturated candy pink and three status hues that never act as brand color.

### Primary
- **Candy Pink** (candy-pink): the only brand accent. Used for the primary pill (加入, confirm), active switches and checkboxes, the scrubbed or hovered progress and volume fill, the active nav icon, the active playlist name, the 正在播放 state, active shuffle/repeat, the repeat-one badge, drop-insertion lines, the focus outline, and the text caret. Hover lightens it (candy-pink-hover) and press deepens it (candy-pink-press). Text on pink is always the near-black on-candy-pink, never white.
- **Pink Wash** (candy-pink-wash): the 14% tint behind selected queue rows, the select-all bar while a selection is active, the new-row arrival flash, and the 3px focus halo on fields.

### Neutral
- **Shell Black** (shell): the page ground between panels and behind the player bar.
- **Panel Charcoal** (panel): every main container (sidebar, main, queue) and the sticky top bar.
- **Raised Graphite** (panel-raised): inputs, selects, dialogs, the reconnect card and empty cover art.
- **Well Graphite** (panel-well): thumbnail wells, mini art placeholders and row action buttons.
- **Hover Wash / Strong** (hover-wash, hover-wash-strong): translucent white overlays for row, nav and icon hover.
- **Hairlines** (hairline, hairline-strong): settings dividers, field strokes, the mobile bar top edge, and secondary button outlines.
- **Text ramp** (text-primary, text-secondary, text-tertiary): titles and values, then meta and inactive controls, then placeholders and fine print. Rails use 22% white as the empty track.

### Status
- **Live Green** (live-green): connection and local-only chips, the success state of the add button, and the saved-row flash.
- **Amber Caution** (amber-caution): redacted sensitive values in settings.
- **Coral Danger** (coral-danger): offline pill, error toasts, and danger buttons and icons, with coral-danger-wash behind danger hover.

### Named Rules
**The One Pink Rule.** Candy pink marks state and the single primary action. It never fills a panel, a heading, or a large surface; the biggest pink areas are a pill button and the 14% selection wash.

**The White Play Rule.** The play/pause circle is white with near-black glyphs. Pink is never the transport's primary color.

**The Status Is Not Brand Rule.** Green, amber and coral appear only when they report something (connected, saved, sensitive, offline, error). They are never decoration.

## Typography

**Display Font:** Figtree variable (300–900, self-hosted latin and latin-ext subsets), falling back to Segoe UI Variable Text, Segoe UI, PingFang TC, Microsoft JhengHei UI, Noto Sans TC
**Body Font:** the same stack
**Label/Mono Font:** Cascadia Mono / Cascadia Code / SFMono-Regular / Consolas, for logs and playlist source URLs only

**Character:** Figtree gives Latin titles and every numeral a round, friendly geometric voice. Traditional Chinese renders in the platform's CJK face. Weight does the hierarchy work: 800 for headings, 650–700 for rows and controls, 400 for meta.

### Hierarchy
- **Display** (800, clamp 28–44px, 1.18, -.025em): the now-playing track title only. A single line that marquees with an edge mask when it overflows. The playlist header uses the same voice a step down (clamp 26–40px).
- **Headline** (800, 26px, 1.2, -.02em): the page title in the top bar (22px at the icon-rail and compact widths). Swaps with a 6px rise on page change.
- **Title** (800, 18–22px, -.01 to -.015em): the queue heading (20px), settings group headings (18px) and dialog headings (22px).
- **Body** (400, 15px, 1.45): the default text size. Settings descriptions run 13px at 1.5, and empty-state copy 14px at 1.6 within a max width of 300px.
- **Row title** (650, 15px, 1.3): queue, playlist and nav labels. Truncated with an ellipsis, never wrapped.
- **Label** (700, 14.5px): button labels; small buttons use 13px.
- **Meta** (400–650, 12.5–14px, tabular): durations, counts, times, latency and volume percentage.

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
- **≤860px:** the layout becomes one column and panels lose their radius. The sidebar becomes a top strip with pill nav where only the active label shows. The queue follows main in page flow. The player bar is fixed to the bottom with a hairline top edge: the progress rail sits on top, then the mini track and play/skip controls. On the dashboard the bar grows to 132px and shows all five transport controls at 44px, a 56px play button, and a centered volume row instead of the mini track.
- **≤480px:** brand text hides and the nav aligns to the start.
- **Touch (hover: none):** row checkboxes and actions stay visible, durations move into the meta line, and the hover-only play overlay is removed.

## Elevation & Depth

The system is flat and tonally layered: shell (darkest) → panel → raised → well, with translucent white washes for interaction. Panels, rows and the bar never cast shadows. Shadows are reserved for objects that float above the plane, and they are always neutral black at large blur. On the dashboard, an ambient light layer (the current cover, blurred 70px and saturated 1.35×, faded into the panel by a vertical gradient) gives the stage depth without a shadow.

### Shadow Vocabulary
- **Cover lift** (`box-shadow: 0 26px 60px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.35)`): the playing cover. Paused, it relaxes to `0 14px 34px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.3)` and scales to .94.
- **Overlay** (`box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.35)`): dialogs and the reconnect card.
- **Toast** (`box-shadow: 0 16px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)`): toasts. The offline banner uses `0 12px 30px rgba(0,0,0,.45)`.
- **Object** (`box-shadow: 0 14px 34px rgba(0,0,0,.45)`): playlist cover tiles and sticker-style memes.
- **Thumb** (`box-shadow: 0 2px 6px rgba(0,0,0,.45)`): the white thumbs on progress and volume, and the switch knob (`0 1px 3px`).
- **Focus halo** (`box-shadow: 0 0 0 3px` pink wash): focused fields only.

### Named Rules
**The Flat Plane Rule.** Panels, rows and the docked player bar sit on the plane with no shadow and no border. Only floating objects (cover, dialog, toast, thumb, sticker) cast one. In the compact single column, stacked panels are separated by hairlines, and the bottom-fixed player bar floats with a hairline-strong top edge and an upward `0 -12px 30px rgba(0,0,0,.45)` shadow.

## Shapes

The shape vocabulary is soft rectangles for content and full pills or circles for anything you press. Containers use 10px (panel). Dialogs and the reconnect card use 12px. Rows and hover fields use 6px, thumbnails 4px, the bar mini art 6px, the cover 8px, and sticker memes 12–14px. Every button, text input, select and status chip is a pill (999px). Icon-only controls and the play button are circles. Settings inputs are the one exception: they use an 8px control radius so they sit flush in dense rows. Rails are 4px tall with fully rounded ends. Checkboxes are 18px with 5px corners and a 2px stroke. Icons are inline 24-unit stroked SVG (2px stroke, round caps and joins) at 18–22px. The brand mark is a 36px pink rounded square holding three meter bars that animate while music plays.

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

### Now-Playing Stage (signature)
The cover sits centered over an ambient-light backdrop, with the display title, then a line with the state, requester and channel. A pink equalizer marks 正在播放. While playing, the cover is at full scale and a small tilted penguin sticker pops out at its bottom-right corner. When paused, the cover settles to .94.

**Track change:** the cover leaves 28px in the skip direction (170ms, ease-in) and then settles in from 44px on the opposite side (600ms, settle curve). Two ambient layers crossfade over 600ms once the next image has loaded, and the title block rises in with a 70ms stagger. With reduced motion the moves are dropped and only fades remain.

### Toasts and Overlays
- **Toast:** a white-on-dark inversion (text-primary background, panel text) with an 8px radius and 14px/650 text. It sits above the player bar, rises in, and has a 3px countdown bar at its base. Errors switch to coral. A meme thumbnail can lead the toast.
- **Offline banner:** a dark coral pill with a round meme avatar.
- **Dialog:** raised graphite with a 12px radius, hairline border, overlay shadow and 26px padding. It rises in over a 62% black backdrop.

### Empty States
A centered penguin meme (124px, 14px radius), then a white 16px/750 line and a short secondary sentence, held to 300px wide.

## Do's and Don'ts

### Do:
- **Do** keep the queue panel and the player bar present on every page; transport is reachable from anywhere.
- **Do** use candy pink only for state and the one primary action per context, with on-candy-pink text on top.
- **Do** build depth from the shell → panel → raised → well ramp, and reserve shadows for floating objects.
- **Do** make every pressable control a pill or a circle, and give it a press response (scale .9–.97, or a 2–3px glyph nudge in its direction).
- **Do** use tabular figures for every time, count and percentage.
- **Do** use penguin memes to fill absence: missing cover, empty lists, offline, reconnecting, toasts.
- **Do** keep motion on the tokenized durations (150 / 250 / 320 / 600ms) and curves, and give every animation a reduced-motion path that keeps only fades.

### Don't:
- **Don't** return to the incumbent dashboard: no grid of glowing cards, and no transport trapped inside one card.
- **Don't** add borders or shadows to desktop panels, rows or the docked player bar; the only exceptions are the compact layout's hairline separators and the shadow on the fixed bottom bar.
- **Don't** introduce a second brand hue; green, amber and coral are status only.
- **Don't** make the play button pink, or put white text on pink.
- **Don't** wrap row titles; truncate them with an ellipsis.
- **Don't** put a meme inside a control's hit area; memes stand in for content or react beside it (stickers, toast avatars), and never decorate a button.
