# pi-buddy

A [pi](https://github.com/mariozechner/pi-coding-agent) extension that gives you a Tamagotchi-style virtual pet in your terminal — inspired by Claude Code's `/buddy`. 18 species, 5 stats, deterministic from your username, with speech bubbles that react to agent activity.

## Display

The buddy parks on the right side of the editor and animates idly (3-frame cycle every ~2s, plus an idle blink). Speech bubbles pop up to its left when it has something to say.

```
                                                  /\___/\
                          ╭────────────────────╮ ( ¬ ¬ )
                          │ of course it broke │  > ‾ <
                          ╰────────────────────╯ /(  |  )\
                                                    ¯  ¯
```

Each species has 3 idle frames (subtle tail wags, ear flicks, particles) so the creature feels alive. State is persisted to `~/.pi/pi-buddy/state.json`.

## Species

Your species is deterministically picked from a hash of `os.userInfo().username` (override with `PI_BUDDY_SEED`):

`duck · penguin · dragon · octopus · capybara · axolotl · cat · fox · owl · panda · raccoon · hedgehog · frog · hamster · narwhal · sloth · turtle · unicorn`

Each species has a stat bias — owls start with high Wisdom, dragons with high Chaos, capybaras with high Patience, and so on.

## Stats

Five stats on a 0–100 scale, drifting based on what you do together:

- **Debugging** — bumps on bash/edit tool runs.
- **Patience** — drains every tool execution; recovers a bit between sessions.
- **Chaos** — spikes on tool errors; calms each turn.
- **Wisdom** — gains slowly per completed turn.
- **Snark** — rises on errors and stays high if you ignore the buddy.

Mood is derived from the stat mix (`happy`, `curious`, `worried`, `grumpy`, `default`) and tints both the accent color and the speech-bubble pool.

## Commands

- `/buddy` or `/buddy stats` — show the full panel (species, age, stat bars, lifetime sessions/turns/tools)
- `/buddy mute` / `/buddy unmute` — silence speech bubbles
- `/buddy rename <name>` — give your buddy a custom name (max 32 chars)
- `/buddy adopt` — re-roll species and reset stats (asks first)
- `/buddy reset` — keep the species, restore stats to baseline (asks first)

## Install

```bash
pi install git:github.com/Acelogic/pi-buddy
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["git:github.com/Acelogic/pi-buddy"]
}
```

## Update

```bash
pi update git:github.com/Acelogic/pi-buddy
```

Then `/reload` inside pi.

## Configuration

Environment variables (all optional):

- `PI_BUDDY_PLACEMENT` — `belowEditor` (default) or `aboveEditor`
- `PI_BUDDY_ALIGN` — `right` (default) or `left`
- `PI_BUDDY_BUBBLE_MS` — how long a speech bubble stays on screen, in ms (default `6000`, min `500`)
- `PI_BUDDY_BLINK` — set to `off` to disable the idle blink ticker
- `PI_BUDDY_ANIMATE` — set to `off` to freeze the creature on frame 0
- `PI_BUDDY_SEED` — override the species hash seed (default `os.userInfo().username`). Set this to share buddies across users or pin a species in CI.

## Notes

- The buddy is non-critical — failures to read or write its state file are swallowed silently so they never break a pi session.
- Speech bubbles fire on a probability per event (e.g. ~60% on `agent_start`, ~35% on tool start) so the buddy doesn't spam you.
- All stat changes happen in-memory and persist on `turn_end` and `session_shutdown`.
- This is a homage to Claude Code's official `/buddy`, not a port — pi has no buddy bridge, so the species is reseeded from your local username.
