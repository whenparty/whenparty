---
title: Speaking the stakeholder’s language
description: 'Engineers see problems from the inside, through code, dashboards and incidents. But the decision about what to do often belongs to someone else, who looks at the problem from the outside and thinks about deadlines, customers, budgets and people. For a technical argument to land, the engineer has to describe the problem the way that person sees it.'
date: 2026-11-25
cover: stakeholders-cover.webp
coverAlt: Amy, a squirrel, and Kate, a deer, look over charts together at a table
shareImage: stakeholders-share.jpg
audio:
  file: speaking-the-stakeholders-language.9e237fe9.mp3
  bytes: 17720155
  seconds: 1477
credits: Conceived and edited by Nikolai Krivous. Drafted by Claude Opus 5.5.
---

## Why a sound argument can fail to land

An engineer explains a problem as they see it, in terms of the code and how the system works. The stakeholder hears a technical detail and misses the connection to their own goals.

### The curse of knowledge

This is called the curse of knowledge. Once someone knows something, it becomes hard for them to imagine how it looks to someone who doesn’t. Economists Colin Camerer, George Loewenstein and Martin Weber coined the term in 1989.

In 1990, Elizabeth Newton, a psychology graduate student at Stanford, conducted what became the best-known experiment on the subject. One group tapped out familiar songs with their fingers; another tried to identify the songs from the tapping. The tappers expected listeners to recognise about half the songs. Of 120 songs, listeners identified three. The tapper hears the tune in their head. The listener hears only tapping. Chip and Dan Heath popularised the experiment in their Harvard Business Review article “The Curse of Knowledge” (2006) and their book Made to Stick (2007).

The same thing happens with technical arguments. An engineer says “the export runs a separate database query for every row” and hears the whole tune: a large file won’t finish generating, a client will raise a support ticket, and a contract could be at risk. The stakeholder hears only tapping.

### Plain language isn’t enough

The engineer can drop the jargon and say “the export is slow”. The words are now easy to understand, but it’s still tapping. The stakeholder still doesn’t know what this means for their work or plans. The engineer needs to follow the reasoning through to something the stakeholder cares about and make that connection explicit. Otherwise, the stakeholder won’t see it, or will draw the wrong conclusion.

In The Software Architect Elevator, Gregor Hohpe compares this work to riding an elevator. At the bottom is the engine room, where the technology gets built. At the top is the penthouse, where company strategy is set. People on each floor speak their own language, and the person riding the elevator has to translate. Hohpe argues that an architect’s value lies in how many floors they can span.

![A paw taps on a table while a tune drifts above it that only the tapper can hear](stakeholders-melody-and-tapping.webp#side)

> Amy was in her second year as a senior engineer on the team behind an online store. The team was building a wholesale portal, due to open to its first ten major clients in six weeks. Kate, a product manager, had joined the team for the launch. Before the launch, the team still had to finish the branch filters, which would let clients filter their orders by branch. The portal’s order export relied on old code. Amy emailed Kate:
>
> “The export module is badly written: a separate database query for every row, no cache, and tests that don’t cover large files. I want to rewrite it next week, which is about five days’ work. By the way, it currently times out on large files. Does that work for you?”
>
> Kate asked whether they could add a cache and suggested revisiting the export after launch.
>
> Amy had long since learned to frame conversations with Ian, the team’s engineering manager, around his goals. But that came easily, because Ian had been an engineer himself and also made product decisions for the main online store. Kate had a background in working with major clients and wasn’t technical. Out of habit, Amy had written to her as though she were another engineer. Amy heard the whole tune in her email. Kate heard only tapping.

## Every stakeholder speaks a different language

There is no single “language of business”. A product manager, an engineering manager and another team see the same problem differently. The engineer has to explain it in the language of whoever they’re talking to.

### What the stakeholder is responsible for

Stakeholders are people who are affected by a decision or can influence it. To reach agreement with them, an engineer needs to understand their responsibilities: their goals for the quarter, commitments to others, the people and time they manage, and the risks they will have to answer for.

The same slow export worries each of them for a different reason. The product manager worries about missing the launch date. The engineering manager anticipates support tickets and more work for the on-call engineer. Another team is nervous about its database if the export reads data from it.

This leads to a common mistake. The engineer brings their own problem (“this module is getting in my way”) and expects the stakeholder to make it a priority. But the stakeholder will respond only once they see how the problem affects their own responsibilities.

![Oliver, an otter, leans on a bench and talks to Amy, a squirrel, who listens with a notebook in her lap](stakeholders-olivers-advice.webp#side)

> Over the next week and a half, Amy approached Kate three more times, each time with a different argument. When Amy brought up the time it took to generate large files, Kate suggested raising the timeout. Amy increased it from one minute to three. They agreed to add retries for failed requests, and Amy added an index to reduce the load on the database. The launch was now just over a month away, and work on the rewrite had yet to begin. Oliver, Amy’s teammate, had been watching from the sidelines. He put it bluntly: “You’re writing to her about your module, but she’s responsible for the launch. She can’t see the connection.”

### Product managers, engineering managers and other teams

Engineers most often need to reach agreement with a product manager, an engineering manager or another team. Here’s what each of them is usually responsible for.

| Stakeholder         | Responsibilities                                                    | Measures they track                    | Decisions they make                                                                  |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Product manager     | Launches, release dates and commitments to customers                | User numbers, revenue and launch dates | What goes into a release, in what order and by when                                  |
| Engineering manager | Delivery commitments, team workload, incidents and on-call coverage | Engineering time and incident counts   | Who takes on which work, and how much time goes to on-call duties and technical debt |
| Another team        | Its own roadmap and system stability                                | Available capacity and service outages | What changes to make to its system, and when                                         |

Companies divide these responsibilities differently. In some, leadership sets release dates and the product manager only prioritises the work. In others, the product manager rather than the engineering manager decides how much time goes to technical debt. How to divide responsibilities and decision-making authority is a subject in its own right.

### When one person wears two hats

An engineering manager may also be responsible for the product or serve as tech lead for an area. That means balancing two sets of priorities. With their product hat on, they want to ship the feature on time. With their engineering manager hat on, they want to keep the team from drowning in incidents. If the question doesn’t name a role, the manager responds from whichever responsibility is uppermost in their mind, and there’s no telling from the answer which one it was.

It helps to name the role in the question:

- “With your product hat on, would you be willing to move the new search to a later release so we can rework payments?”
- “As engineering manager, who could you assign to spend a week on the rework?”

This makes it clear which perspective is needed. It also brings conflicting priorities into the open: “From a product perspective, I’m against it. As engineering manager, I can see why it matters. Let’s look at the numbers.”

### How to find out what matters to a stakeholder

Because responsibilities vary between companies, the simplest approach is to ask the stakeholder, and to ask early, before bringing a proposal. Questions like “What matters most to you this quarter?” or “What would a successful launch look like?” often produce answers the engineer didn’t expect. Written goals such as OKRs and roadmaps, and the updates the stakeholder sends to their own manager, can also show their priorities.

![Kate, a deer, shows Amy, a squirrel, a tray of ten client cards](stakeholders-client-cards.webp#side)

> After talking to Oliver, Amy asked Kate what a successful launch would look like, expecting to hear a date. Instead, Kate explained that the ten clients’ first quarter would be a trial. Success meant keeping all ten after the trial ended. Amy asked what those clients wanted from the portal. Almost all of them, Kate said, had requested an order export for their accounts teams.

## What the stakeholder needs to know

Once the audience and their priorities are clear, the next question is what to say. From the start, a stakeholder needs answers to three questions. What’s happened? What’s at stake for me? What do you need me to do? These give the explanation its three parts: the problem, the consequences and the proposal.

| Part         | The stakeholder’s question | What to include                                                | Example                                                                                                         |
| ------------ | -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Problem      | What’s happened?           | The facts in the stakeholder’s terms, without technical jargon | Some major clients won’t be able to export a quarter’s orders                                                   |
| Consequences | What’s at stake for me?    | How their priorities will be affected, how seriously and when  | Three of the ten initial clients are joining partly for the export feature, which won’t work for them at launch |
| Proposal     | What do you need me to do? | A recommendation, its cost, a specific request and a deadline  | A week of one engineer’s time before launch, the branch filters ship after launch, a decision needed by Friday  |

Engineers most often leave out the consequences. The problem is easy to name, the proposal is usually ready, and the consequences seem obvious. Without them, however, the stakeholder has no basis for weighing the proposal against other work. Time goes to the work whose consequences someone has explained.

### What to say first

The detailed explanation follows that order, but the opening should give the main point: what will happen and what the engineer proposes to do about it. For example: “Some major clients won’t be able to export a quarter’s orders when we launch. I propose a week to rework the export before launch, which means the branch filters ship after launch. Can you approve that by Friday?”

This is the idea behind Barbara Minto’s Pyramid Principle. The main point comes first, and the supporting arguments sit beneath it. Readers who know the conclusion can see how each argument supports it. Readers who don’t know it have to hold the details in their heads while waiting to see where the explanation is going.

The US Army follows the same principle in its standards for official correspondence, Army Regulation 25-50, where it is known as BLUF, bottom line up front. Someone who reads only the first sentence should still get the main point.

In conversation, a stakeholder may need a moment to get up to speed. In that case, the first sentence can say what will be needed from them: “I need your decision on the order export. Let me explain why.” When they know the decision will be theirs, they listen differently and weigh each argument with that decision in mind.

### Lead with the news that matters most

When there is both good news and bad news, the news that matters most goes first, even when it’s the bad news. Starting with good news puts the stakeholder at ease, and a serious problem disclosed later then looks like an attempt to bury it. For example: “Some major clients won’t be able to export a quarter’s orders when we launch. The catalogue with contract pricing is ready, as is payment by invoice.”

This may seem to conflict with the feedback sandwich, which places criticism between two positive comments. But that technique is intended for feedback on someone else’s work, where keeping the person motivated is part of the aim. Here, the stakeholder needs to make a decision, and the first thing they need to hear is what that decision depends on.

### When to lead with a technical detail

Technical details usually belong later in the explanation. The stakeholder can’t assess them, and the conversation drifts towards implementation. Instead of deciding what to do about the launch, everyone ends up discussing whether to add a cache. Sometimes, though, the technical detail is the right place to start:

- The stakeholder is an engineer who will fix the problem. “Your API is returning the amount field as a string rather than a number, so we can’t calculate invoice totals.”
- There is an incident and every minute counts. “The main payments database is down, and no payments have gone through since 14:05.” The technical fact and its consequence fit in one sentence.
- The stakeholder has asked about the technical cause.

![Amy, a squirrel, reads Kate’s Friday launch update on a laptop, its first line highlighted: “The launch is on track, with one risk”](stakeholders-friday-update.webp#side)

> Every Friday, Kate sent leadership a short launch update, copying in the team. Amy used to skip these emails. Now she noticed that the first sentence contained everything that mattered: “The launch is on track, with one risk: two of the initial clients haven’t signed their contracts, and I need a decision by Wednesday on whether to offer them a discount on their first order.” Below that, Kate explained the situation, the stakes and her proposal. Amy realised that Kate expected the same kind of email from her.

## The problem through the stakeholder’s eyes

The first thing a stakeholder wants to know is what has happened, and the engineer has to tell it the way the stakeholder will see it. That means tracing the technical facts through to consequences the stakeholder can assess for themselves.

### Keep asking “so what?”

The engineer starts with a technical fact and keeps asking “so what?” until the answer connects to something the stakeholder is responsible for. For a product manager, the reasoning might run like this:

1. The order export runs a separate database query for every row. So what?
2. A file containing 50,000 rows takes about five minutes to generate. So what?
3. The server ends the request after three minutes, so the user gets an error instead of a file. So what?
4. Order history shows that three of the ten initial clients will need quarterly exports of that size. So what?
5. Those clients are joining the portal partly for the export feature, which won’t work for them at launch.

The place to stop is the step the stakeholder can assess for themselves. A product manager doesn’t need an explanation of why it matters that three major clients can’t use a feature they need. They understand that better than the engineer does. Going further, to “the company will lose millions”, is risky without evidence. A single exaggeration is enough for the stakeholder to stop trusting the whole chain of reasoning.

For an engineering manager, the reasoning takes a different turn after step three: failed exports generate support tickets, each of which needs the on-call engineer’s attention.

The stakeholder usually needs to hear only the last steps: what the user will experience and how that affects the stakeholder’s responsibilities. The earlier, technical steps are kept ready for when the stakeholder asks how the engineer reached that conclusion.

## Discussing consequences without exact numbers

Consequences lie in the future, so nobody knows them exactly. It is tempting either to stay vague (“it’ll be slow”) or to invent precision (“performance will drop by 30%”). Both get in the way of the stakeholder’s decision. With the first, they have nothing to compare against. With the second, they’re comparing against something made up.

### A back-of-the-envelope estimate instead of an exact figure

A decision often requires only a sense of scale: hours, days or months, ten users or ten thousand. A back-of-the-envelope calculation of this kind is often called a Fermi estimate, after the physicist Enrico Fermi, who could quickly estimate an answer to almost any question. The unknown quantity is broken down into factors that can be estimated, and the factors are multiplied together. Errors in individual factors partly cancel each other out, so the result usually lands on the right order of magnitude.

What separates a useful estimate from an invented number is a clear basis for each factor. Here are two claims to compare.

- “This module makes the team three times slower.” There is no explanation of where that figure came from or how to check it.
- “We had six payment incidents last quarter, each taking about a day of the on-call engineer’s time. That’s roughly a week of engineering time per quarter.” The numbers can be checked, and the calculation is clear.

If a factor is an assumption, the engineer says so, for example: “assuming there are about ten clients like this”. The stakeholder can then tell the evidence from the assumptions.

In How to Measure Anything, Douglas Hubbard advises measuring only what could change the decision. If the product manager would put off the fix whether the problem costs the team one week a quarter or two, there’s no point refining that estimate. If the difference would change the decision, that is where further measurement is worthwhile.

### When a consequence can’t be estimated

A vulnerability might never be exploited, or it might lead to the theft of customer data, and there’s no way to say exactly how likely that is. In that situation, the comparison is between what is known for sure: what the work costs now, and whether the consequences could be fixed later.

In his 2015 letter to Amazon shareholders, Jeff Bezos distinguishes between one-way and two-way doors. One-way doors represent decisions that are difficult or impossible to reverse, so they are made slowly and carefully. Two-way doors represent reversible decisions, which can be made more quickly. This distinction can help explain why one issue can wait while another needs attention now.

- “We can upgrade the library next month without increasing the cost.” That’s a two-way door.
- “Once partners build integrations against this API response format, changing it will break those integrations.” That’s a one-way door.
- “If customer data leaks, we can’t undo the disclosure.” Another one-way door.

This comparison lets the stakeholder weigh a known cost against a consequence that would be difficult or impossible to reverse, even when the probability remains uncertain.

### What is known, what isn’t, and how to find out

Uncertainty is easily hidden behind a promise such as “I’ll have it done in two days”, although the engineer can’t always be sure of that estimate. The stakeholder plans around those two days and learns the truth only when the deadline slips. It helps to break the uncertainty into four parts.

| Part                             | Example                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| What we know                     | Stock levels on the site no longer match the warehouse after the overnight sync. This has happened three times this week |
| What we don’t know               | Whether the fault is in our sync or in the data the warehouse sends                                                      |
| How and when we’ll find out      | I’ll compare this week’s warehouse data with our database and report back on Thursday                                    |
| What we’re doing in the meantime | We’re checking stock levels for the best-selling items manually each morning                                             |

The stakeholder can see what is reliable now, what remains uncertain, and when to expect an answer.

![A tray of client cards with three yellow cards set apart from the other seven](stakeholders-three-out-of-ten.webp#side)

> A couple of days later, Amy explained the export problem in Kate’s terms: after launch, some major clients might be unable to download the quarterly file their accounts teams needed. Kate asked how many clients would be affected. Previously, Amy would have guessed. This time, she separated what she knew from what she still needed to find out. She had already confirmed in the test environment that exports timed out whenever a file took more than three minutes to generate. Amy promised to check the order history and report back by Wednesday on how many clients needed files of that size. Meanwhile, she worked on a plan for the rework. On Wednesday, the answer was three out of ten. For the first time since Amy had raised the export issue, Kate asked which clients they were.

## How many arguments to make

Engineers often have more arguments than a stakeholder needs. Both the number of arguments and the way they are presented can weaken a case.

### A weak argument weakens a strong one

It seems reasonable to assume that every additional argument makes a case more convincing. Experiments show the opposite. In 2012, Kimberlee Weaver, Stephen Garcia and Norbert Schwarz described the presenter’s paradox: presenters tend to add up the value of their arguments, while listeners tend to average them. A weaker argument therefore dilutes a stronger one. In one experiment, a $750 fine for littering seemed harsher than the same fine combined with two hours of community service.

So the engineer leads with the argument that matters most to the stakeholder, adds one or two supporting points, and keeps the rest ready for questions. If the strongest argument appears only at the end, after “by the way”, the stakeholder will already have formed an opinion based on the weaker ones.

### When arguments arrive one at a time

An engineer brings one argument and gets a no, returns a week later with a second, then tries a third. Each point seems minor on its own and receives a quick fix. The underlying problem never gets discussed. That is how Amy spent the week and a half after her first email to Kate: three arguments, three quick fixes, and no rewrite. On top of that, a third attempt with yet another argument starts to look like pressure.

It’s better to bring the whole case at once and mention any secondary reasons in a single line, for example: “There are two smaller reasons as well. Happy to go through them if that would help.”

The engineer can keep the discussion on the underlying problem in two more ways:

- Name the quick fix before the stakeholder does, and show the cumulative cost. “We could correct the stock levels manually after the overnight sync again, but that would be the fifth manual correction this month. The last four have already taken about two days of on-call engineers’ time, and the mismatches return every week.” This lets the stakeholder compare the total cost of repeated fixes with the cost of a rewrite.
- State what would change the recommendation. “If the sync fix keeps stock levels in line with the warehouse for a month, we won’t need a rewrite. I won’t raise it again unless new evidence emerges.” This turns a disagreement into a test with an observable result.

![Amy, a squirrel, writes an email beside three yellow cards while Ian, a badger, holds up a plan that reads “1 week”](stakeholders-second-email.webp#side)

> Kate now knew which clients were affected. Amy needed a decision, so she sat down to write another email. She had plenty of arguments, but led with the strongest one for Kate: three of the initial clients were joining partly for the export feature, which wouldn’t work for them at launch. She held back the points about the database queries, the cache and the tests in case Kate asked, because in the first email the mention of a cache had pulled the conversation towards implementation. Amy also named the obvious quick fix herself: they could raise the timeout again, but that would be the fourth quick fix, and the previous three had already taken about four days. Finally, she explained what would change her recommendation: if these clients’ accounts teams already exported orders month by month, the rework could wait until the end of the trial quarter.

## Whose decision is it?

The stakeholder’s final question is what they are being asked to do. Usually, the answer is to make a decision, and it’s easy to get two things wrong: exactly what decision is being asked for, and who should make it.

### A recommendation, not just a list of options

A bare list of options leaves someone who knows less about the problem to evaluate them. They’ll either pick at random or hand the question back: “What do you recommend?” A recommendation reduces that work while leaving the decision with the stakeholder. The engineer still lays out the alternatives, then says which one they would choose and why. For example:

“We have three options.

1. Rework the export before launch. That takes one engineer for a week, and the branch filters ship after launch.
2. Launch with a limit on export size and warn the three affected clients.
3. Rework the export in the first two weeks after launch.

I recommend the first option. The limit would affect exactly the clients who are joining the portal for the export feature.”

Ending with “Does that work for you?” is no substitute for a recommendation. By itself, it doesn’t establish what needs approval, what it will cost, or when an answer is needed. The response is often “let’s discuss it”, and the decision is postponed.

There is one exception. If the choice depends on priorities the engineer doesn’t know (for example, whether the launch date matters more than a complete feature for major clients), a recommendation turns into guesswork. In that case, it’s more honest to lay out the options with the cost of each and say what the choice depends on.

### Inform, invite objections, or ask for a decision

Before asking, the engineer needs to work out whose decision it is. If a proposal affects something another person controls (team capacity, a slot in the sprint, a launch date or another team’s system), the decision is theirs, even if the engineer knows more about the technology. An engineer who announces “I’m rewriting the export next week” presents that person with a done deal and makes the decision for them. If the choice concerns only how the engineer carries out their own task, it’s enough to keep others informed.

There are four common approaches:

| Approach                                          | Example                                                                                                                                                                                                              | When it fits                                                                       | Risk if misused                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Give a heads-up                                   | “I’m moving the order ownership check into the shared module. Just letting you know.”                                                                                                                                | The decision affects only the engineer’s own work and time, and is easy to reverse | If the decision affects someone else’s work, the person responsible for it is presented with a done deal                           |
| Proceed unless someone objects                    | “I’ll switch the overnight warehouse sync to the new queue on Tuesday unless anyone objects by Monday.”                                                                                                              | The effect on others is small and reversible, but someone may have objections      | For a significant decision, silence may only mean the email went unread                                                            |
| Recommend an option and ask for explicit approval | “I recommend spending a week reworking the export before launch, with the branch filters shipping after launch. Can you approve this by Friday, so the rework is ready in time for launch?”                          | The decision affects someone else’s work or can’t be undone                        | Used for minor choices, it takes up the stakeholder’s attention and slows progress                                                 |
| Present options without a recommendation          | “We can launch with an export size limit, or rework the export first and release the branch filters after launch. Both are technically viable. The choice depends on which feature the initial clients need sooner.” | The choice depends on priorities the engineer doesn’t know                         | When the priorities are already clear or the choice is purely technical, it creates unnecessary work for someone with less context |

In Apache Software Foundation projects, proceeding unless someone objects is known as lazy consensus. A contributor announces an intention and allows time for objections, usually 72 hours. If no one objects, they can proceed. Later objections still receive consideration, and the change can be reversed if necessary.

### How to ask for a decision, and what happens if there’s no answer

The engineer asks directly and says what decision is needed, who needs to make it and by when. The deadline needs a real reason, for example: “by Friday, or the rework won’t be ready in time for launch”. An arbitrary deadline is easy to push back. A deadline with a reason is harder to move, because it’s clear what a delay would cost.

It also helps to say up front what will happen if no answer arrives: “If we don’t have a decision by Friday, we’ll launch with an export size limit and warn the three clients.” Then silence becomes a decision too, and the stakeholder can see what it costs. The default should be the option that doesn’t use other people’s time or change their plans without asking.

![Kate, a deer, moves a card that reads “Branch filters” from “This sprint” to “Next sprint” on a whiteboard](stakeholders-kates-decision.webp#side)

> Before sending the new email, Amy reread her first one. She had asked Kate to approve something Kate couldn’t decide without Ian, and she hadn’t spelled out the cost or the deadline. Kate decided what went into the launch. Ian decided who on the team worked on what. The only thing Amy could decide herself was how to build the new export, and for that it was enough to keep the team informed.
>
> Ian agreed to assign Amy to the rework if the branch filters could ship after launch. So Amy asked Kate directly: could they launch without the branch filters? Her new email included a recommendation, the cost, a Friday deadline so the rework could be ready in time for launch, and a fallback if no answer arrived. Kate called the finance manager at one of the three affected clients and learned that they needed a single file for their quarter-end close. The next morning, she agreed to launch without them.

## Further reading

| Source                                                                                                                                                                   | Why read it                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [Barbara Minto, The Minto Pyramid Principle](https://www.barbaraminto.com/)                                                                                              | The conclusion first, with the arguments beneath it                                 |
| [Gregor Hohpe, The Software Architect Elevator](https://www.oreilly.com/library/view/the-software-architect/9781492077534/)                                              | How an engineer connects the technical side of a company with its business strategy |
| [Gregor Hohpe, The Architect Elevator: Visiting the upper floors](https://martinfowler.com/articles/architect-elevator.html)                                             | A short version of the elevator idea on martinfowler.com                            |
| [Chip Heath, Dan Heath, The Curse of Knowledge (Harvard Business Review, 2006)](https://hbr.org/2006/12/the-curse-of-knowledge)                                          | The curse of knowledge and Elizabeth Newton’s tapping experiment                    |
| [Curse of knowledge (Wikipedia)](https://en.wikipedia.org/wiki/Curse_of_knowledge)                                                                                       | Where the term comes from: Camerer, Loewenstein and Weber, 1989                     |
| [BLUF (Wikipedia)](https://en.wikipedia.org/wiki/BLUF_%28communication%29)                                                                                               | Bottom line up front and its source, the US Army correspondence standard AR 25-50   |
| [Jeff Bezos, 2015 Letter to Shareholders](https://www.sec.gov/Archives/edgar/data/1018724/000119312516530910/d168744dex991.htm)                                          | One-way and two-way doors, in the Invention Machine section                         |
| [Apache Software Foundation, Lazy consensus](https://community.apache.org/committers/lazyConsensus.html)                                                                 | Proceeding unless someone objects                                                   |
| [Douglas Hubbard, How to Measure Anything, chapter 7, Quantifying the Value of Information](https://www.oreilly.com/library/view/how-to-measure/9781118836446/c07.xhtml) | Measuring only what could change the decision                                       |
| [Fermi problem (Wikipedia)](https://en.wikipedia.org/wiki/Fermi_problem)                                                                                                 | Estimating by order of magnitude                                                    |
| [Kimberlee Weaver, Stephen Garcia, Norbert Schwarz, The Presenter’s Paradox (Journal of Consumer Research, 2012)](https://doi.org/10.1086/664497)                        | Why a weak argument next to a strong one spoils the overall impression              |
