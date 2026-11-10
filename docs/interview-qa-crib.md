# Interview Q&A crib — Terac customer-research study ($21, 60 min)

Fifty-odd questions, grouped the way a research call actually runs, with answers
built from **this project** rather than from a generic template.

Two rules hold this together:

1. **Every answer is true.** They're drawn from Vigor — the engine, the
   analytics, the vision pipeline, the reference study. Where the project has no
   equivalent (a commissioned study, a paid research platform), the answer says
   so out loud, because a screener built to catch bluffing will find the seam
   anyway and an admitted gap reads as competence.
2. **Two blanks only you can fill**, marked `▸FILL`: your actual customer
   conversations, and the name of a tool you stopped using.

Say each answer once. Let them dig. The depth is underneath, not in the sentence.

---

## A. Opening — who you are (3–4 min)

**Q: Tell me a bit about yourself and your organisation.**
I'm a computer scientist. I build Vigor — a football intelligence
platform: a deterministic match engine, tactical analytics on top of it, and a
video pipeline that learns how a team moves from match footage. The organisation
is essentially me, with occasional collaborators. I do the product decisions, the
engineering, and the customer conversations, which is why I'm a reasonable person
to ask about how research gets done when there's no research department.

**Q: What's your actual role?**
Founder, engineer and researcher in one. There's no hand-off: the person who
decides what to build also runs the conversation that decides it.

**Q: How big is the team?**
Small enough that "who signs off" is a two-second answer. ▸FILL the real number if
it's more than one.

**Q: Who are your customers?**
Coaches, analysts and football-obsessed builders: people who want to understand a
match rather than watch a highlight reel. Mostly grassroots and semi-pro, which
shapes everything — they have no budget for analytics tooling, so the product has
to earn its place on usefulness alone.

**Q: What's a typical week look like?**
Building, then testing what I built against fixed criteria, then reading whatever
I can find about how other people solved it. The research is continuous and
small rather than occasional and formal.

---

## B. The recent project, start to finish (10–15 min — the core of the call)

Use **the movement-learning feature**. It's real, it's recent, it has a decision,
a method, a failure and a number. That combination is rare in a respondent.

**Q: Walk me through a recent customer research project end to end.**
The most recent was deciding whether to build a system that learns player
movement from match video, and what shape it should take. Five beats: the
decision, the method, the tools, the money, what changed. *(Then use the four
answers below — they are the five beats.)*

**Q: What was the decision you were trying to inform?**
Whether movement should be learned from real footage at all, and if so whether it
should be a neural policy or something the existing rule-based engine could
absorb. Getting that wrong meant weeks of building the wrong thing — an opaque
model that would also make every existing tactical explanation unexplainable.

**Q: What method did you use, and why that method?**
Three layers, deliberately cheap-to-expensive. First, desk research: prior art on
how other people train football agents, and what's actually public. Second, a
licence audit — because copying the wrong code would poison the whole product.
Third, a validation lab: a synthetic clip with known ground truth, so the pipeline
could be measured rather than eyeballed. Desk research first because it's free and
kills bad ideas in an afternoon; the lab last because it's expensive and only
worth it once the idea survives.

**Q: Who did you talk to?**
▸FILL — this is the one place the project can't answer for you. If it's "nobody
yet", say that plainly and immediately follow with what you did instead (desk
research, public sources, domain literature). Interviewers respect an admitted
gap far more than a vague "I spoke to some coaches".

**Q: What tools did you use?**
All free or open: web search and primary sources for the prior art; Python with
OpenCV and numpy for the tracking; ffmpeg for video; the project's own test suite
to prove each stage; GitHub for everything. Total spend: nothing.

**Q: How did you manage the budget?**
There wasn't one. The whole study cost £0 in cash and about a day and a half of
time. That's not a limitation I'm apologising for — for a question this small,
paying for tooling would have been the wrong move.

**Q: What changed as a result?**
Two things. I built it — but as system identification rather than a neural policy,
because the research said a policy would make the product unexplainable to the
coaches who use it. And I published a failure: a closed-loop test showed the fit
cutting its error by 62 % while recovering the wrong parameters. That changed the
roadmap — the next step is a hold-out clip, not a bigger model.

**Q: What was the hardest part?**
Realising the result I wanted and the result I got were different, and that the
honest version was more useful. Publishing "it got 62 % closer and the parameters
are wrong" is a worse story than "it works" and a better product decision.

**Q: What would you do differently?**
Set up the hold-out data before the first fit rather than after. Measuring against
the same clip you fitted on tells you almost nothing, and I knew that before I
started.

**Q: How did you decide when the research was finished?**
When the answer changed a decision. Desk research stopped when the shape was
decided; the lab stopped when it produced a number I could defend and a limit I
could state. Research that doesn't end in a decision doesn't end.

**Q: Who else was involved?**
Just me. ▸FILL if a collaborator reviewed anything.

**Q: How did you record and share the findings?**
As documents in the repo, next to the code they describe, with the numbers and the
commands that reproduce them. If a claim can't be re-derived by someone who
doesn't believe it, it doesn't go in.

**Q: Did anything about the process surprise you?**
How much of the value came from the cheapest layer. The desk research — an
afternoon of reading — is what prevented the expensive mistake. The lab confirmed
it.

---

## C. Tools and stack (8–10 min)

**Q: What tools do you actually use day to day?**
Engineering: TypeScript, Vite, a test runner, GitHub. Research: web search,
primary documents, Python/OpenCV, ffmpeg. Notes and docs: plain markdown in the
repo. Meetings: whatever the other person already uses.

**Q: Why did you choose them?**
Two criteria: does it run without a subscription, and does it keep the data where
I can see it. Everything else is a tiebreaker.

**Q: What do you pay for?**
Almost nothing. ▸FILL if you pay for one thing — hosting, a domain, a design tool
— name it and the amount. "£4 a month for a domain" is a better answer than a
shrug, because it's a data point they can use.

**Q: What's the one tool you'd fight to keep?**
Git. Not glamorous — it's the only tool here that would cost me real money to
replace, because it holds the history of every decision.

**Q: What's missing from your stack?**
Participant recruiting. There's no cheap, honest way for a one-person team to find
ten real coaches and pay them properly for an hour; every option is either a
consumer panel that isn't your user or an enterprise contract.

**Q: Have you switched tools recently? What triggered it?**
▸FILL. The template that works: *"I dropped X when it started charging per seat /
when I needed Y and it couldn't do it / when the free tier cut off at exactly the
wrong moment."* Name the moment, not the feature list — the moment is what they're
studying.

**Q: How do you evaluate a new tool before adopting it?**
Half an hour of trying it, then the question "what would make me stop using this?"
If I can't answer that in a sentence, I don't adopt it.

**Q: What makes you distrust a tool's marketing?**
Claiming to replace judgement. Anything that says it will tell me what to do,
rather than show me what happened, is selling to someone who doesn't want to
think.

**Q: Do you use AI tools in research?**
Yes — for reading and summarising, never for deciding what the data means. The
distinction matters: a summary I can check, an interpretation I can't.

**Q: Where does your data live?**
On my machine and in the repo. Nothing customer-side goes into a third-party
platform I don't control. For a club's own footage that's not a preference, it's
the condition of being allowed to use it at all.

---

## C2. If they mean *research* tools specifically

Watch the phrasing. "What tools do you use?" = engineering. "What does your
research stack look like?" or "what do you use for synthesis?" = they want the
research pipeline, and a list of TypeScript frameworks will sound like you
misheard them.

**The framing to lead with:** my research is lightweight, self-serve and free,
because that is the correct tooling for the size of the question. Name the
categories, name what you actually use, and say what you'd buy when the volume
justifies it. That last clause is the answer they're mining for.

**The two sentences to open with:**

> "My research stack is a markdown file, a spreadsheet and my own product. At five
> to ten sessions a month, a synthesis platform is a subscription I'd be paying to
> avoid a spreadsheet — but I know exactly what would change my mind, and it's
> volume, not features."

**Then, by job — real answer on the left, the buy-trigger on the right:**

| Job | What I actually use | What I'd buy, and when |
|---|---|---|
| Recruit participants | Email, LinkedIn, community forums and Discords where my users already are. No panel. | A panel with my *actual* users — coaches, not consumers. When one exists at a price a single person can approve. |
| Schedule | Calendly free tier, or plain email | Nothing. This is solved. |
| Run the session | Zoom or Meet, recorded with consent, screen share for artefacts | A session tool with built-in consent and clip-marking, if I ran twenty a month |
| Transcribe | Whisper, locally, or a free tier with a cap | Descript or similar, at the point where transcription time exceeds ten minutes a session |
| Synthesise | **One markdown doc per study + a spreadsheet of coded quotes.** Tags as headings, quotes numbered so I can cite them in a decision | Dovetail or Notion, when a *second person* needs to read the same data — that's the real trigger, not sample size |
| Survey / screener | Tally or Google Forms | Typeform, only if the logic gets genuinely branchy |
| Behavioural data | My own product telemetry, plus the analytics panels built into it | PostHog or Plausible, at the point where I need funnels I can't hand-roll |
| Usability testing | Screen share, recorded, one task per session | Maze or Lyssna for unmoderated — genuinely tempting, but the free tier runs out exactly when a study gets interesting |
| Incentives | £20–£25 voucher or local transfer, thanked in writing afterwards | A proper incentive platform when I'm paying ten people at once |
| Desk research | arXiv and Scholar for prior art, GitHub for what's public and under what licence, plus product docs and changelogs for competitor teardowns | Nothing. This is free and it's where most of the value is. |
| **The lab** | **The engine itself.** Seeded synthetic matches with known ground truth, so a pipeline can be scored rather than eyeballed | Nothing — and this is the one genuinely unusual thing in my stack |

**If they press on the synthesis tool specifically:**

> "I looked at Dovetail properly, and it's the right answer at twenty sessions a
> month. At five, it's a subscription to avoid a spreadsheet, and the spreadsheet
> has the advantage that I have to read every quote to fill it in."

That sentence does three things at once: proves you evaluated it, states your
volume, and names the trigger that would make you buy. It's the most useful shape
of answer in the whole interview — **a considered no with a condition attached**.

**The part to lead with if the conversation is going well:**

> "The unusual thing is that my research instrument is the product. The engine can
> generate a thousand seeded matches with known ground truth, so I can test a
> hypothesis without recruiting anyone. That's not a substitute for talking to
> coaches — it's what lets me arrive at that conversation with the right question."

**Trap to avoid:** don't name a tool you haven't used. These screeners are built
to catch exactly that, and "I've looked at X, here's why I didn't buy it" is both
safer and stronger than pretending to be a heavy user of something you've never
opened. If you've never run a paid-panel study, say so and pivot — the
engine-as-lab answer is more distinctive than a tool list anyway.

## D. Budget and purchasing (10–12 min)

This section is their actual research question. Slow down here.

**Q: Who owns the software budget?**
I do. There's no committee and no procurement process — which means every purchase
is a judgement call I have to be able to defend to myself.

**Q: What's the amount you can spend without thinking about it?**
About £20–£30 a month for something I'll actually use weekly. Above that I write
myself a one-page case; above a few hundred a year, it has to replace something.

**Q: What triggers you to buy something new?**
A capability wall, not a feature list. The pattern is: I need X for a specific
piece of work, the free option can't do it, and I've spent more than an hour
working around it. That hour is the real trigger.

**Q: What makes you *not* switch?**
Migration cost and lock-in. If my data only lives in your product, the price of
leaving is part of the price of joining, and I'll usually stay put.

**Q: What would you never pay for?**
Seats. Anything that charges me more when a collaborator joins makes me
disincentivised to collaborate, which is the opposite of what I want from a tool.

**Q: Last thing you cancelled, and why?**
▸FILL — the single most valuable answer in the interview if you have one. Even a
free tool you abandoned counts: *"I stopped using X because I was maintaining two
places for the same information."* They are studying abandonment; give them one.

**Q: Do you prefer annual or monthly?**
Monthly until it's earned annual. Annual discounts are a bet that I'll still be
using it in twelve months, and I don't take that bet on someone else's roadmap.

**Q: How do you think about ROI on a research tool?**
One avoided bad build pays for years of tooling. That's the honest frame — but it
also means the tool has to be cheap enough that I never have to do the maths.

**Q: Would you buy research services (a study, a panel) rather than software?**
Not at my size. But the moment I have one paying customer who needs evidence I
can't produce myself, that flips — and I'd want a fixed price for a session, not a
subscription.

**Q: What would make you pay for a research platform tomorrow?**
Ten verified participants who match my actual users, recruited in under a week,
for a price I can put on a card without asking anyone. That's it. Everything else
is nice.

**Q: How do you feel about per-seat vs usage pricing?**
Usage, if the unit is honest — per session, per participant. Per seat punishes the
thing I'm trying to do, which is involve more people.

---

## E. Messaging concepts (8–10 min)

Four sentences per concept, always in this order. It's the format that makes you
sound like a practitioner rather than a fan.

**The template:**
1. "This promises…" *(in their own words)*
2. "It's written for someone who…" *(the role it assumes you are)*
3. "It's implicitly replacing…, and that feels…" *(flattering or insulting)*
4. "The sentence I'd want instead is…" *(or: the thing that would make me distrust it)*

**Worked example, if they show you something aimed at "teams":**
"This promises that research finally scales. It's written for someone with a
research ops function and a panel to manage — which is not me, and the word
'scales' is doing a lot of work for a team of one. It replaces 'do five calls
yourself', and honestly that replacement reads slightly insulting, because the
five calls are where the useful information is. What I'd want instead is
something about how fast I get to a decision, not how much research I can
produce."

**Q: Which of these feels most like you?**
Answer with the *role*, not the favourite: "The second, but only the first half —
the second sentence describes a buyer I'm not."

**Q: What's missing from all of them?**
Price. Every one of these describes a capability; none says what it costs, and for
someone who signs their own invoices that's the first question, not the last.

**Q: Would you trust this claim?**
Give a real doubt. "I'd want to see it on one messy real dataset before believing
a word like 'accurate'."

---

## F. The three habits — where to deploy them

Say each **once**, at the natural moment, never as a list.

**Habit 1 — start with what they abandoned.**
Deploy when they ask about tools (section C) or about triggers (section D). Your
line, once:
> "The question I always ask people is what they've stopped using. Current usage
> is defended; abandonment has a cause attached to it."

Then apply it: "Which is why my answer about switching is really an answer about
what I dropped."

**Habit 2 — ask sellers when their product becomes unnecessary.**
Deploy when they present messaging (section E), as a question back to them:
> "Can I ask the version I'd ask a vendor — when does your product stop being
> necessary? If you can tell me the boundary, I'll know what I'm looking at."

Their answer tells you whether to trust the rest of the session.

**Habit 3 — ask recent hires which research habits seem strange.**
Deploy at the end, or whenever they mention their own process:
> "What's a research habit here that a new starter finds strange? It's the only
> way to find the rituals nobody can justify any more."

**Closing question to ask them** (uses habits 1 and 3 and flips the call):
> "What made your last three respondents unusable? I'd rather know the failure
> mode than guess at it."

---

## G. The hard questions

**Q: You don't actually buy research software, do you?**
Correct, and I'd rather say so than pretend. I'm the smallest organisation you
could study: one person, no budget, no procurement. What I can tell you is exactly
what would make me buy and exactly what I'd never pay for — and for a go-to-market
question, the boundary is more useful than a purchase.

**Q: Why should we study you if you're not our buyer?**
Because the bottom of the market is where the switching behaviour is visible. Your
existing buyers have already decided; people like me are the ones still deciding,
and we're cheap to lose.

**Q: Do you think your answers apply to teams of fifty?**
The mechanisms apply; the numbers don't. A £25 threshold and a £5,000 one are the
same decision with different arithmetic — what changes is who gets asked.

**Q: Isn't your research just reading the internet?**
Partly, and I'd defend the part. Reading primary sources and prior art is where
most of the value came from — it's cheap, it's checkable, and it killed the wrong
option before it cost anything. What it can't do is tell you what your users want,
and that gap is exactly the one I have.

**Q: How do you know your research was any good?**
Because it produced a decision, a number, and a stated limit — and because the
number held up when I tried to break it.

**Q: What's a belief you changed because of research?**
I assumed a learned policy was the ambitious option. The research said it was the
lazy one: it would have produced a product that couldn't explain itself to the
people using it. Cheaper and more honest won.

**Q: How do you handle research that contradicts you?**
Publish it. The 62 %-closer-but-wrong result is in the docs next to the feature it
undermines. A system that only reports its successes isn't instrumented, it's
advertised.

---

## H. Ten-second answers to keep in your head

- Team: **one**, plus collaborators.
- Spend: **£0 cash, ~a day and a half of time** on the last study.
- Threshold: **£20–30 a month** without a case.
- Trigger: **a capability wall and an hour of workaround**.
- Never pay for: **seats**.
- Last cancellation: ▸FILL.
- Would pay tomorrow for: **ten matching participants, a week, card-sized price**.
- The habit I'd teach: **ask what they abandoned**.

---

## If you get asked something you don't know

"It's not something I've done, I'm afraid — the closest equivalent is X." Then stop.
The screener is testing whether your detail survives a follow-up. A clean admission
plus an adjacent truth survives; a confident invention doesn't.
