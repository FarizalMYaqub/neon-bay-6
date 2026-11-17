# neon-bay-6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/FarizalMYaqub/neon-bay-6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/FarizalMYaqub/neon-bay-6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** is an open-world crime game in the spirit of GTA 6, built from
scratch for make.fun's "Make GTA 6" bounty. A fictional sunset city with a
street grid, a beach and sea, lit-window towers, a neon-arch plaza and palm
trees — all original, no Rockstar names, places, characters or assets.

Play on foot or behind the wheel: steal one of the parked cars, weave through
AI traffic, dodge pedestrians, and mind the wanted stars — police cruisers
with flashing light bars will chase and ram you. Run three story missions for
Mara, fight rival gang members, and lose the cops to take the city.

What's inside:

- A full 3D city (Three.js, vendored) with sunset lighting, long shadows,
  a beach, palms, streetlights and a neon plaza
- On-foot third-person controls: walk, run, jump, punch, shoot (raycast
  pistol with tracers, ammo and reload)
- Driving: 5 stealable parked cars plus 16 AI traffic cars on the road grid,
  arcade handling, speed HUD
- Wanted level 0–5 stars with police pursuit, sirens, and decay when you
  lay low
- 3 missions with dialogue, objective beacons, minimap markers and a
  completion screen; progress saves to localStorage
- Live 2D minimap, health / cash / clock / objective HUD, start + pause
  screens
- Synthesized WebAudio only: engine hum, sirens, gunshots, pickup chimes
  and a synthwave loop — no audio files

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. Keyboard + mouse,
no network requests — everything is local static files.

## Screenshots

The four shots in `screenshots/` are real renders of the game in a headless
browser (seeded, deterministic): the title screen over the city, driving
through traffic, a 3-star police chase, and mission 1 with its objective
beacon.

<sub>Entered on [make.fun](https://make.fun/?ref=qk9k9vgs&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
