# Profile — computer scientist

*An abstract of how one engineer works, generalised deliberately. The evidence
comes from a single long project in this workspace; the claims below are the ones
I believe would still hold if the project were a compiler, a trading simulator or
a game server. Where I'm extrapolating rather than reporting, I say so.*

---

## The one line

**Builds systems that can be interrogated — and refuses to ship one that can't.**

## The short version (~110 words)

A computer scientist who treats *measurement as part of the design*, not a phase
after it. Sets acceptance criteria before writing code and holds the work to them
while it is still moving. Prefers to fix a definition rather than add a dial, to
delete a metric rather than correct it with a fudge factor, and to publish a
failed experiment next to the result it failed to support. Works fluently in the
domain the software serves, because the criteria only come out right if you
understand what the thing is *for*. Says no in five words and expects the same
back.

## The full version (~380 words)

Some engineers build systems whose correctness is a theorem. This one builds
systems whose correctness is a judgement — does the thing behave the way the
domain says it should — and has made that judgement rigorous rather than
rhetorical.

The method is unfashionably old: **change one thing, measure, keep or discard.**
Criteria are set before the work, not discovered after it. Figures are published
with their method and their sample size. A result that looked good on one seed is
run on sixty before it is believed, and a result that only survives because of a
scaling constant is thrown out rather than adjusted. "It works" is not an
argument; a reproducible command and a table is.

Behind that method is a sharper instinct: **the shape of the system is the
argument.** When a behaviour won't move, the answer is rarely another parameter —
it is a definition that was too narrow, a boundary drawn in the wrong place, or a
metric measuring something adjacent to the thing that matters. The reflex is to
find the lever that makes five others unnecessary, and then to remove the five.
Additive engineering is what you do when you haven't understood the problem yet.

Two things follow. First, **legibility is a correctness property**: a control
nobody can explain, a model nobody can argue with, a metric nobody can
re-derive — these are defects, not trade-offs. Second, **failure gets written
down in the same document as the result**, because a system that reports only its
successes isn't instrumented, it's advertised. That includes failures of one's own
work, named precisely, with the number attached.

The rest is craft discipline: knowing that staging beats ambition (the cheap,
checkable version first; the expensive one only after it earns its place),
knowing that a pause is a sequencing decision and not a retreat, and knowing that
the last ten percent of a system is instrumentation rather than features.

*I'd rather ship a smaller thing that is true than a larger thing I can't
measure.*

---

# The doctrine

Ten habits, named so they can be argued with. Each is a rule of thumb that
generalises past any single project.

**1. The experience is the spec.**
Acceptance criteria are written before the first line of code and are stated in
the language of the user, not the implementation. "Fluid play matters more than
goal count" is a specification; "goals per match between 4 and 9, most 4 to 6" is
its testable form. Both get written down.

**2. One variable at a time.**
Single-change experiments, measured against a fixed baseline, with the result
kept or discarded on evidence. Slow, unglamorous, and the only way to know *why*
something got better.

**3. A number that needs a fudge factor is a lie with a workaround.**
If a metric only makes sense after a scaling constant, the metric is wrong. Delete
it and measure something adjacent that doesn't need the constant. This is treated
as a correctness bug, not a documentation task.

**4. Fix the definition before you add the dial.**
When behaviour won't move, widen what counts as the event rather than adding
another parameter to the rule. Parameters are debt; definitions are capital.

**5. Everything must be re-derivable.**
If a claim appears in a document, there is a command that produces it and a test
that guards it. Same input, same output, byte for byte. Evidence ships with the
assertion or the assertion doesn't ship.

**6. Publish the failure in the same place as the result.**
Closed-loop checks, honest no-results, and measurements that contradict the
design go in the document, with numbers. A report that only contains wins is
marketing.

**7. Legibility is a feature.**
Roles over sliders. Explanations over opaque weights. If a human can't read the
model and disagree with it, the model isn't finished. This constrains the
technique choice — a simpler mechanism that can be explained beats a stronger one
that can't.

**8. Reduce before you add.**
Fewer knobs, fewer options, fewer concepts. Every addition has to displace
something or justify itself in the same breath.

**9. Stage the ambition.**
Cheap and checkable first, expensive and unverifiable later — and only if the
cheap one proves the seam. Known limits are stated at the moment the work ships,
not discovered by the next person.

**10. Say no precisely.**
Corrections are short, unhedged, and specific. Vagueness is expensive; precision
is a courtesy. Expects the same in return and works better for it.

---

# The signature

What someone would notice after a month, rather than read on a CV.

- **Domain fluency used as engineering input.** Learns enough of the field to know
  which requirements are the real ones, then argues from the domain instead of
  from the ticket.
- **An allergy to demos.** A demo is a hypothesis. The interest starts when the
  same behaviour holds across seeds, opponents and time.
- **Comfort at every layer.** Capable of moving from a numeric detail in a physics
  loop to a licence obligation to a colour token without losing the thread — and
  usually the person who notices that the three are the same decision.
- **Instrumentation as the default reflex.** Before tuning anything, build the
  thing that will tell you whether the tuning worked. Frequently the instrument
  solves the problem by itself.
- **Sequencing discipline.** Will stop a working, interesting thread mid-stride
  because the next thing matters more. Most engineers can't; it's the trait that
  separates finishing from accumulating.
- **Calm under ambiguity.** Provides the missing specification rather than asking
  for permission — and accepts being told it was wrong without either defending or
  collapsing.

# Where this fits

Roles where the answer isn't in a specification and correctness is behavioural:

- simulation and interactive-systems engineering, where the output is behaviour
  under uncertainty;
- applied research engineering — vision, learning, estimation — in organisations
  that need the result to be explainable to a domain expert;
- technical leadership of systems whose success criteria are contested and whose
  metrics are therefore political;
- tooling and measurement infrastructure, the work nobody asks for and every
  serious codebase quietly depends on.

Not a fit: environments where velocity is measured in tickets, where a demo is
the deliverable, or where a metric is required to look good rather than be true.

# What the record shows

For anyone who wants evidence rather than adjectives — all of it from one project
in this workspace, one instance per trait:

| Trait | One instance |
|---|---|
| Definition over dial | Corner volume moved 2.26 → 2.88 a match by widening what counted as a defensive touch, after five conventional levers measured dead. |
| Metric integrity | Rejected per-90 normalisation on a short simulation and replaced simulated distance-as-workload with metres per minute of play. |
| Re-derivability | Required a headless engine with byte-identical output per seed, so every documented figure can be reproduced by someone who doesn't believe it. |
| Criteria first | Goals 4–9, ~78 % on target, "fluid football over goal count" — fixed before the work, held throughout. |
| Failure published | A closed-loop check showed the fitter cutting error 62 % while recovering the wrong parameters; it went into the doc rather than into a drawer. |
| Legibility | Roles instead of role sliders, because a holding midfielder should hold without anyone reading twelve numbers. |
| Reduce | Rejected new options in favour of removing the ones that did nothing. |
| Precise correction | Four offered interpretations, one five-word answer, and the work redone in the right direction. |

# Three lines, if you need them

> **Short:** Builds behavioural systems and the instruments that prove they work,
> in that order.

> **Middle:** Computer scientist working where simulation, measurement and product
> meet. Fixes systems by narrowing definitions rather than widening parameter
> counts, and publishes the failure cases beside the results.

> **Long:** see the full version above.

# What I left out, and why

- **Credentials.** Degrees, institutions, years, employers, publications — not in
  this workspace, so not invented here.
- **Superlatives.** No "world-class", "passionate", "visionary". A profile written
  in that register would fit worse than a shorter one written plainly.
- **Generality I can't support.** The abstractions are inferred from one project.
  If they don't hold across the rest of the work, the fix is to narrow the claims,
  not to soften the language.
