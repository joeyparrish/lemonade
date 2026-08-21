# Lemonade Web: Design

Date: 2026-08-20
Status: approved, pending implementation plan

## Context

Lemonade! v4.20 is a BBS door game published by T&J Software in 1996, written in
Microsoft BASIC PDS 7.1 and linked against the DoorFrame library. The player is
given one dollar to start a lemonade stand and tries to make as much money as
possible over a fixed number of game days. Each day presents a weather forecast,
then asks how many glasses to make and what to charge per glass in whole cents.
Weather and temperature drive demand, rain destroys the day's sales, and random
news events raise the cost of ingredients.

This project reimplements that game as a single player web application. The
original program is the specification: its behavior is recovered by reverse
engineering the shipped binary rather than guessed at from the documentation,
which describes the rules but none of the numbers.

## Goals

Reproduce the original's behavior faithfully enough that someone who played the
door game recognizes it: the same demand pressures, the same cost dynamics, the
same feel of a run. Deliver it as a static, single player web application that
works well on a phone. Keep the simulation isolated from the presentation so
that the game logic can be reasoned about, tested, and replayed independently of
any user interface.

## Non-goals

Bit exact reproduction is explicitly not a goal. An earlier draft of this design
proposed proving equivalence with a differential test harness driving the
original binary; that was dropped as disproportionate. Consequently there is no
requirement to reproduce the original's floating point precision behavior, no
requirement to reproduce its pseudorandom number generator, and no differential
oracle in the test suite.

The door game framing is also out of scope. Plays per day, game days per real
day, the monthly high score reset, the shared bulletin file, and the sysop
configuration screen all existed to ration a shared phone line and have no
meaning for a single player web app. What survives is the session shape: a run
is a fixed number of game days, played start to finish, producing a score.

Run length was a sysop setting in the original rather than a property of the
program, so it is not recoverable from the binary. It is fixed at thirty days,
the value in the shipped configuration file, and held as a named engine constant
so that it can be changed in one place.

There is no backend, no accounts, and no shared scoreboard.

## Source material

The distribution archive contains the compressed executable, a set of ANSI
screen files, high score and configuration data files, and documentation. The
executable holds all of the game logic and is the only source for the numbers.

The archive and its extracted contents are deliberately excluded from version
control. They are third party copyrighted material retained locally as reverse
engineering source material. The ANSI screens in particular are authored
expression rather than mechanism, and are not reproduced: this project draws its
visual aesthetic from them but redraws everything.

### What is extracted

The executable is compressed by a self relocating packer. The tooling
decompresses it, locates the game logic, and reads the following:

- Demand as a function of price, temperature, and weather condition.
- Per glass cost, and how each of the three news events perturbs it.
- Weather and temperature generation, and the relationship between the forecast
  shown to the player and the conditions actually applied.
- Starting cash.
- Input bounds and validation behavior.
- End of run scoring.

Recovered constants are transcribed directly into the engine source as named
values. An earlier draft proposed a generated constants file carrying the
address each value came from; this was dropped in favor of readability, since
provenance is not a requirement.

## Architecture

Three layers, plus offline tooling.

The reverse engineering tooling lives in `tools/re` and is written in Python. It
decompresses the executable by loading it into an emulated real mode processor
and running its own unpacking stub, then produces an annotated disassembly. It
never ships to the browser and is not on the application's dependency path. It
is retained in the repository because it is the only record of how the game's
numbers were determined.

The engine lives in `src/engine` and is pure TypeScript with no DOM access, no
file or network access, and no reference to the clock or to a global random
source. It is the whole of the simulation.

The user interface lives in `src/ui`, reads engine state, renders it, and
collects player decisions. It is built with Vite and plain TypeScript with no
framework, because the game is a small state machine with a handful of screens
and a framework would be more ceremony than it earns.

### The engine boundary

The engine is a pure function of a seed and a sequence of player decisions. This
is the central design decision and the one that everything else depends on.

Purity buys three things. Tests become trivial to write and impossible to make
flaky. A run can be replayed exactly from its seed and inputs, which makes bug
reports reproducible and makes a share link possible later at no additional
design cost. And the simulation can be reasoned about without holding any
rendering concerns in mind.

Determinism requires a seeded generator, so the engine carries a small modern
pseudorandom generator (mulberry32) whose state is part of engine state rather
than ambient. The extracted formulas are expressed against a uniform value in
the half open interval from zero to one, so substituting a different generator
underneath is invisible to the model's behavior. The original's generator is not
reproduced.

Illustrative interface shape, not prescriptive:

```
startRun(seed: number): GameState
advanceDay(state: GameState, decision: Decision): DayOutcome
```

`GameState` holds cash, the current day index, current per glass cost, the
pending forecast, and the history of completed days. `Decision` holds the number
of glasses to make and the price per glass in cents. `DayOutcome` holds the
weather that actually occurred, glasses sold, revenue, cost, and resulting cash.
Every one of these is plain data and serializable, which is what makes
persistence and replay straightforward.

## Fidelity policy

Faithful, not exact. Where the original does something surprising, the default
is to preserve it rather than correct it, because the surprises are a large part
of what makes it the same game. The version history records, for example, that
charging above roughly fifty cents per glass makes a sale very unlikely, and
that the number of glasses a player may make is capped. Behavior of this kind is
kept.

Any deliberate deviation from recovered behavior is documented at the point in
the engine where it occurs, with the reason. An undocumented deviation is a bug.

Because there is no differential oracle, correctness of the extracted model
rests on careful reading of the disassembly. As proportionate insurance, the
completed engine is sanity checked against the original running under DOSBox-X:
a handful of hand played days, comparing outcomes for gross discrepancies such
as an inverted comparison or a misplaced factor of ten. This is a smoke test,
not a proof, and is described as such. That check was carried out and found no
discrepancies.

### One rule the port adds

A run also ends when the player cannot afford a single glass, rather than only
after thirty days. Below that threshold the only available move is a zero glass
day, which can never earn anything back, so the run is a dead end. The summary
screen distinguishes this from a completed season.

This is an addition rather than recovered behavior. What the original does when
a player is broke was never established, so this is not a claim about it. The
engine comments say so at the site, in line with the policy above.

## User interface

The game is presented through ordinary DOM elements and real form controls
rather than a terminal emulator. That choice keeps it accessible and usable on a
touch screen, which a character grid would not be.

The period aesthetic comes from restraint rather than emulation: the sixteen
color EGA and VGA palette exposed as CSS custom properties, a fixed width font
stack, box drawing borders, hard edges, and stark contrast. No gradients, no
rounded corners, no shadows.

The layout descends from the original's main play screen, which places an output
window beside a weather panel, above a status strip carrying days remaining,
cash, and current price per glass, with a list of available commands. On a wide
viewport the two panels sit side by side. On a narrow viewport they stack, the
status strip becomes a sticky header, and the commands become a bottom action
bar within thumb reach.

### The input surface: resolved, no change needed

Each day asks two numeric questions: how many glasses to make, and what to
charge per glass. Free text numeric entry looked like a poor fit for a phone, so
the first implementation shipped plain accessible numeric inputs, explicitly
labelled a placeholder, and the real design was deferred until there was
something playable to react to.

Phone testing settled it in favour of the placeholder. Two things had been
missed. A number input behaves differently by platform in a way that suits both
ends: desktop renders increment steppers, and mobile omits them but raises the
numeric keypad on focus. Separately, carrying the previous day's glasses and
price forward turned most days into an adjustment rather than fresh entry,
which removed most of the typing the concern was actually about.

Steppers with tuned increments, presets on the price band edges, a price slider
with a numeric readout, and a "same as yesterday" shortcut were all considered.
The prefill made the last redundant and the others would have added furniture
without earning it. The shipped form is therefore the answer rather than a
placeholder awaiting one.

### The bundled font is load bearing

The art is built from block and box drawing characters, and several common
system monospace fonts lack them. Android's default lacks the half blocks the
title uses. A missing glyph makes the browser substitute another face for that
single cell, and the substituted advance width does not match, so the row
skews.

The app therefore ships a subset of DejaVu Sans Mono rather than relying on a
system face, and `tools/font/subset.py` verifies that every codepoint the art
and interface use is present at a uniform advance width before writing the
file. Coverage alone is not enough, since a glyph present at the wrong width
skews a row exactly as badly as a missing one. Re-run that tool after changing
the art; it exits non-zero rather than producing a font with a hole in it.

## Persistence

Browser local storage under a versioned schema key, holding the run in
progress, a local high score table, and the screen the player was last on.
Storage access is wrapped so that a private window, cleared site data, or a
browser that refuses storage degrades to an in memory session rather than
failing.

Loading the page always opens on the splash screen, whatever was stored.
Returning should be a choice rather than a surprise: nobody is dropped straight
back into a game, or into the high score list, without asking for it. The
stored screen is read only when Resume is pressed, which returns the player to
the exact point they left, including a day's results they had not yet read.
Only the screens belonging to a day in progress are stored, so browsing the
high scores does not move the resume point.

## Testing

The engine is developed test first. Its purity means every test is a plain
assertion over values with no setup, no mocking, and no clock control.

Coverage falls into three groups. Unit tests pin each recovered formula against
worked examples derived while reading the disassembly. Scenario tests exercise
whole runs from a fixed seed, including the edge cases that the original's
version history calls out: the maximum glass count, prices at and above the
point where demand collapses, and a rained out day. Invariant tests assert
properties that must hold across many random seeds and decision sequences, such
as cash never becoming negative through a purchase the game permitted, and
glasses sold never exceeding glasses made.

The user interface is tested only where it carries logic, chiefly input
validation and the persistence wrapper. Layout is verified by playing it.

## Repository layout

```
docs/            Design and specification documents.
tools/re/        Python reverse engineering toolkit.
src/engine/      Pure TypeScript simulation.
src/ui/          Vite front end.
work/            Reverse engineering intermediates. Not committed.
original/        Extracted game files. Not committed.
```

## Risks

The largest risk is a misread formula. It is mitigated by the DOSBox-X sanity
check and by the fact that the arithmetic disassembles into readable floating
point operations with legible constants, but it is not eliminated, and this is
an accepted consequence of dropping the oracle.

A smaller risk is that some part of the model turns out to depend on state that
is not a function of the seed and the player's decisions, such as the system
date. If that occurs, the dependency is modeled as an explicit engine input
rather than being read ambiently, preserving purity.

## Phasing

1. Promote the reverse engineering toolkit into `tools/re`, extract the full day
   loop, and record the recovered model.
2. Build the engine against that model, test first.
3. Sanity check the engine against the original under DOSBox-X.
4. Build the desktop user interface.
5. Design and build the mobile input surface.

Phases one through three produce a tested engine with no user interface. If the
recovered model is wrong, that is where it surfaces, before any presentation
work is invested.
