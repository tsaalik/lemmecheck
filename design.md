# Beantown Hub — Visual Design Direction

A new look for the app, inspired by a modern sports-app aesthetic: dark background,
high-energy accent color, rounded cards, circular team badges. This keeps the app's
existing structure (home screen with four team launchers, team detail screen with
schedule and highlights) — it's a re-skin, not a rebuild. Written in plain language so
it's easy to check against before any code changes.

## Colors

- **Background:** near-black, slightly green-tinted charcoal (`#0b0f0d`) — not pure
  black, so it feels a touch warmer and ties back to the team colors.
- **Cards:** a lighter dark gray-green (`#161a17`), with a subtle 1px border
  (`#262b27`) so cards read as distinct surfaces against the background.
- **Accent color (the energetic one):** a bright lime-green (`#c6f73e`). Used for:
  active/selected states, the "LIVE" tag, key numbers (scores, records), link text,
  and button backgrounds. This is the one color that should feel electric — everything
  else stays muted so the accent actually pops.
- **Text:** off-white (`#f4f6f3`) for primary text, a muted sage-gray (`#8a9389`) for
  secondary text (labels, captions, timestamps).
- **Status colors:** the lime accent doubles as "LIVE," and a clear red (`#ef4444`)
  stays for "FINAL," same as today — red and lime read as opposites (past vs. happening
  now), which is useful at a glance.
- **Team badges:** each team keeps its own real brand color as the badge's fill (Red
  Sox red, Patriots navy, Celtics green, Bruins black/gold) — unchanged from today.
  These are the one place color varies per team; everything else in the UI uses the
  shared palette above.

## Fonts

- **Headings and labels:** bold, condensed, uppercase sans-serif (system font stack —
  no web font to load). This is already Beantown Hub's style; keeping it.
- **Body text:** regular-weight system sans-serif, sentence case.
- **Scores and records:** monospace, bold — keeps that sports-scoreboard feel and
  makes numbers easy to scan.

## Spacing and shape

- **Corners:** generously rounded — 18–20px on cards, fully round (pill-shaped) on
  tabs and small buttons. Nothing sharp-cornered.
- **Card padding:** roomy, ~18px, so content doesn't feel cramped against the dark
  background.
- **Team badges:** circular, ~64px on the home screen, ~44px on the team detail
  header — same sizing as today, just restyled (a thin lime ring appears around the
  badge you're currently viewing, instead of a border-color hover).
- **Grid gaps:** consistent ~16px between cards, matching today's spacing.

## Main parts

- **Header:** switches from today's white bar to a transparent/dark bar — the app
  name in bold condensed caps, no background color of its own (blends into the dark
  page background).
- **Ticker:** keeps its current scrolling behavior, but restyled onto the dark
  background with lime-green text instead of white-on-black, so it reads as "the
  accent color in motion" rather than a separate black strip.
- **Team launcher tiles (home screen):** dark cards, circular team-color badge
  on top, team name below in bold caps, record + division standing below that in the
  muted secondary color. Tapping one is the only interaction, same as today.
- **Team detail screen:** same structure as today (Next Game / Live Now section,
  Recent Games list) — restyled as dark cards with lime-accented section labels
  instead of the current amber/orange.
- **Game cards:** dark rounded cards, team names and scores in the new palette,
  Boston's row highlighted in lime instead of amber. "FINAL"/"LIVE" tags keep their
  red/lime distinction.
- **Highlights panel:** unchanged structurally (video, Key Plays, Final Score) —
  just restyled with lime section labels and dark backgrounds instead of today's
  amber-on-white.
- **Buttons/links** ("Watch on YouTube," back button): lime text, no background,
  same as today's amber links just in the new color.

## What's NOT changing

- No new navigation (no bottom tab bar) — the app still has just two screens: home
  and team detail, reached by tapping a tile and the back button.
- No new features — this is purely a visual re-skin of the existing structure.
- Team badges stay as colored circles with the sport emoji (⚾🏈🏀🏒), same as today —
  not real team logos, which are trademarked.
