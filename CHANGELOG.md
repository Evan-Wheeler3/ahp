# Lights Out — v3 changelog

## Progression and economy
- The economy was rebuilt around building armor. Each district has an armor grade. Bricks get more HP (steel girder columns get double HP and carry 3x load), stress strength rises per district, and pay per brick rises with both armor and depth. Every weapon therefore has a district where its income peaks, which forces upgrades.
- Pay starts low (early runs earn a few hundred to a couple of thousand dollars) and prices span $600 to $9M.
- The progression model (`tests/economy.js`) maxes everything in about 22.5 h over about 225 runs. That assumes a player earns 0.35× of the bot's rate; see the balance sheet comment at the top of the script.
- **Deploy checkpoints.** After reaching a district, you can start runs at any even district below it, so late runs don't replay trivial districts.
- **Blackout (prestige).** Unlocks at district 10. It wipes cash, weapons and upgrades in exchange for Fuses = √(cycle $ / 200K). Fuses buy five permanent perks: cash, damage, starting armor/shield, deep deploy after a Blackout, and keeping low-tier weapons.
- **Threats scale with depth.** Missile and drone HP rise every district, waves grow (about 1 + district/4), bombers arrive from D6 and swarms from D9.
- Old v2 saves keep their best distance and get a $500 bankroll. The v2 economy can't be carried over.

## Weapons (6 → 19, in 7 tiers)
| Tier | Weapon | Behavior / niche |
|---|---|---|
| 1 Small arms | Slug, Carbine, Scattergun | single shell; 3-round burst; 6 pellets that spread with distance, short range |
| 2 Autocannons | Autocannon, Flak gun, Chain gun | hold-to-spray with heat; airburst proximity shells (anti-air); spins up, heat, medium range |
| 3 Explosives | Rocket, Skip bomb, Cluster bomb, Demo charge | big blast; bounces and re-detonates, shrinking each skip; blast plus bomblets; sticky charges with a 1.6 s fuse (max 3) |
| 4 Incendiary | Napalm, Thermite | spreading fire, slowed by armor; melts a shaft straight down from the impact point |
| 5 Energy | Cutting laser, Arc coil, Railgun | continuous short-range beam with heat; chain lightning on a leash; charge-up short beam |
| 6 Heavy ordnance | Howitzer, Seismic charge | lobbed shell that drills down from the roof; charged quake that shakes one block apart |
| 7 Exotic | Black hole, Orbital lance | city-anchored hole that ignores armor; 1 s targeting, then a lance and a wide base strike |

Each weapon has Mk II–VI upgrades (+12% damage, −5% cooldown, +5% radius per level), and Mk VI adds a special effect. A tier unlocks only once you own a weapon from the tier below.

## The railgun and runaway collapses (root-cause fixes)
- **Railgun.** Now tier 5 with a 0.6 s charge, a 3.2 s cooldown, and a 54 px beam starting at the aim point (76 px at Mk VI) about 4 bricks tall. It has a 160-brick budget and 14 damage, so deep steel stops it. Each brick is hit once, which fixes a bug where the beam re-applied full damage every frame.
- **Collapse budget per shot.** Each shot has a budget (1, or 2 for cluster and orbital). Once it is spent, other overstressed blocks hold until something hits them again. Collapses are also spaced at least 0.14 s apart.
- **Radius cap.** Blast radius multipliers (Mk × Blast power × BIG) are capped at 1.8×. The black hole is anchored to the city instead of the screen. Arc-coil chains, quake width and orbital width are all bounded.
- **Test coverage.** `tests/balance.js` fires every weapon at Mk VI with every upgrade and BIG active, and asserts that no shot removes ≥50% of the bricks on screen or flattens ≥75% of the blocks on screen.

## Upgrades (4 → 21, plus 95 Mk levels and 5 Fuse perks)
- **Offense:** Blast power, Fast reload, Hardened shells, Heat sinks, Capacitors.
- **Economy:** Salvage rights, Demolition permits, Bounty contracts, Chain demolition (combo multiplier), Insurance.
- **Defense:** Armor plating, Field repair (regen), Shield generator, Point defense (auto-turret), Early warning, Reactive plating.
- **Utility:** Supply drops, Long fuse, Crate magnet, Lead computer (aim snap and lead), Loadout rack (3 → 6 bar slots).
- New Coolant crate.
- The Armory now has sticky tabs (Weapons / Offense / Economy / Defense / Utility / Blackout), with a dot on tabs where you can afford something. Weapons are grouped by tier, with Equip/Mk buttons and stat lines. Every touch target is ≥44 px.

## Smoothness and performance
- **Fixed-step simulation** at 1/60 s, with up to 4 catch-up steps after a slow frame and variable sub-steps on 120 Hz screens. No more 33 ms jumps.
- **Pooled particles.** Effect particles and burning bricks are now struct-of-array pools (no per-frame allocation), and building canvases are pooled.
- **Building generation.** At most one block per step, generated 260 px ahead. Blocks are painted in runs with a cached mortar pattern (about 390 draw calls instead of about 5,000).
- **Batched clears.** Collapses and floating-chunk drops clear the canvas in one call per run, not per brick.
- **Fewer draw calls.** Rubble is bucketed by colour with a counting sort, and glyphs, discs and rings come from sprite caches. Median `fillRect` calls per frame fell from 2,354 to 899 in the stress profile.
- **Budgeted structure checks.** At most 3 buildings are analysed per step, round-robin.
- **Pool pressure.** Rubble lingers less when the particle pool is busy.
- **Audio.** A single shared noise buffer, and repeated tones are throttled.
- **Camera and timing.** Smooth sinusoidal shake capped at 5 px, eased slow-mo only for big collapses with a 2.5 s gap between them, and difficulty ramps continuously instead of jumping at district borders.
- **Input.**
  - Aim snaps to threats near the crosshair and leads them (the snap radius grows with Lead computer). Shells still lead the scrolling city.
  - The crosshair shows a cooldown ring, a charge ring, a heat bar, an out-of-range warning and a lock marker. Bar buttons show cooldown and heat.
- **iOS.** The HUD is offset by the safe-area insets (it was under the notch before). Pinch, double-tap zoom and rubber-banding are blocked outside the Armory list, audio unlocks on first touch, and localStorage is wrapped everywhere.

## Tests (`tests/`)
- `smoke.js`: runs `node --check`; boots with no storage; migrates a v2 save; fires every weapon; forces collapses; runs 6 simulated minutes with hitches; walks death, Armory and Blackout. After every volley it checks that `cnt` matches the grid and that HP is set exactly where bricks are.
- `balance.js`: checks that early weapons can't topple armored towers, that each tier out-clears the previous one in its home districts, the single-shot limits, the railgun's shape, survival ceilings, and that the model stays within 15–25 h.
- `economy.js` / `measure.js` / `survival.js`: the seeded throughput and survival matrix plus the progression model.
- `perf.js`: hot-path timing. `browser.js`: headless Chromium at iPhone 13 size.

## Not tested on a real device
- Frame rate and draw-call cost on an actual iPhone. Every number here comes from Node or desktop headless Chromium.
- Real touch feel: aim snap, hold-to-fire latency, Armory scroll vs tab swipe.
- Safari's safe-area values, the audio unlock and haptics.
- The 15–25 h figure is a model built on a bot plus assumptions about human efficiency, not playtest data.
