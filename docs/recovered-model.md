# Recovered Game Model

What the original Lemonade! v4.20 binary actually computes, recovered by static
analysis of the decompressed image. This is the reference the engine implements.

Regenerate the analysis inputs with:

```
python tools/re/unpack.py original/LEMON.EXE work/dump.bin
python tools/re/annotate.py work/dump.bin 3400 1200 > work/dayloop.asm
```

Money in the original is BASIC PDS CURRENCY: a 64 bit integer scaled by 10,000.
Counts and rolls are IEEE single precision. Every `INT()` below is BASIC's
`INT`, which floors. All values here were read out of the image, not inferred
from the documentation.

## Constants

| Quantity | Value | Source |
| --- | --- | --- |
| Starting cash | $1.00 | currency 10000 at DGROUP 0x15bc |
| Starting cost per glass | $0.02 | currency 200 at DGROUP 0x1610 |
| Maximum glasses per day | 60,000 | currency 600000000 at DGROUP 0x173c |
| Maximum price per glass | $200.00 | currency 2000000 at DGROUP 0x1850 |
| Run length | 30 days | sysop config, not in the binary |

## Order of a day

Steps 1 through 3 happen before the player is prompted, and 5 through 7 after.
The precise interleaving of 1 and 2 is inferred from the screens the original
displays rather than proven, because the relevant blocks are reached through a
runtime dispatch rather than a direct branch. Nothing downstream depends on
which of the two runs first, since they touch disjoint state.

### 1. News event, which raises cost

Only considered while the current cost per glass is below $0.12. Once cost
reaches that threshold no further events fire, so cost tops out at about $0.15.

Roll `INT(rnd * 100 + 1)`:

| Roll | Event | Cost change |
| --- | --- | --- |
| 1 to 10 | Sugar | plus $0.02 |
| 11 to 20 | Lemons | plus $0.03 |
| 21 to 25 | Paper cups | plus $0.04 |
| 26 to 100 | None | none |

Cost never decreases.

### 2. Weather

```
r = INT(rnd * 100 + 1)
chanceOfRain = (r < 70) ? r : 0
temperature  = 70 + INT(rnd * 35 + 1)      // 71 to 105
```

Roughly a third of days are guaranteed dry. The temperature draw sits inside a
retry loop that rejects anything below 70, which given the formula can never
trigger.

### 3. Forecast

The player is shown the temperature and the percent chance of rain. Both are
the real values. There is no divergence between forecast and outcome.

### 4. Player input

```
glassesAffordable = MIN(INT(cash / costPerGlass), 60000)
```

The player chooses how many glasses to make, up to that limit, and a price per
glass entered in whole cents, up to $200.00.

### 5. Rain

If the chance of rain is zero the day is dry and no roll happens. Otherwise it
rains when `INT(rnd * 100 + 1) <= chanceOfRain`.

### 6. Demand

A base coefficient is selected by price band, then by temperature band:

| Price per glass | 70 to 79 | 80 to 89 | 90 to 95 | 96 and up |
| --- | --- | --- | --- | --- |
| $0.12 or less | 0.8 | 0.9 | 1.0 | 1.0 |
| $0.13 to $0.25 | 0.7 | 0.8 | 0.9 | 1.0 |
| $0.26 to $0.50 | 0.6 | 0.7 | 0.8 | 0.9 |
| $0.51 to $0.75 | 0.5 | 0.6 | 0.7 | 0.8 |
| $0.76 to $1.25 | 0.4 | 0.5 | 0.6 | 0.7 |
| $1.27 to $1.50 | 0.2 | 0.3 | 0.4 | 0.5 |
| $1.51 to $2.00 | 0.1 | 0.2 | 0.3 | 0.4 |
| above $2.00 | 0 | 0 | 0 | 0 |

Then:

```
jitter = (price > 2.00) ? 0 : INT(rnd * 10 + 1) / 100     // 0.01 to 0.10
coefficient = MIN(bandCoefficient + jitter, 1.0)
glassesSold = INT(glassesMade * coefficient)
if raining then glassesSold = 0
```

The temperature bands are lower inclusive and upper exclusive: 70 to 80, 80 to
90, 90 to 96, and 96 upward.

### 7. Economics

```
totalCost  = glassesMade * costPerGlass
totalSales = glassesSold * pricePerGlass
profit     = totalSales - totalCost
cash       = cash + profit
```

Cost is charged on glasses made, not glasses sold, so a rained out day still
bills the player for the whole batch.

### 8. Score

Final cash at the end of the run.

## Quirks preserved

These are faithful reproductions of original behavior, not mistakes in the
port. Each is deliberate under the project's fidelity policy.

**A price of exactly $1.26 matches no band.** The bands run up to $1.25
inclusive and then resume above $1.26, so $1.26 falls between them and the
coefficients keep whatever values they held from the previous day. The
coefficient ladder also skips a rung at the same place, stepping from
0.4/0.5/0.6/0.7 straight to 0.2/0.3/0.4/0.5, which suggests a band was removed
during development and this pair of thresholds is the residue.

**No demand band covers temperatures below 70.** Unreachable, because the
temperature draw cannot produce a value below 71. Recorded because it explains
the shape of the code, not because it can happen.

**Cost escalation stops at $0.12.** The event check gates on cost being below
that, so a long run plateaus rather than becoming unplayable.

## Randomness

The original draws from BASIC PDS `RND` at exactly five points: the news event
roll, the chance of rain, the temperature, the rain outcome, and the demand
jitter. The port keeps the same five draws in the same order but uses its own
seeded generator, since reproducing the original generator is not a goal.
