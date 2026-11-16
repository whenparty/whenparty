---
title: Influence without authority
description: "The more senior an engineer gets, the more decisions depend on them. But making a decision isn’t enough. It still has to be pushed through. A manager can order their own team to carry it out. An engineer with no direct reports has no one to give orders to, so they move decisions forward in other ways, most often through influence."
date: 2026-11-16
audio:
  file: influence-without-authority.45d97fc5.mp3
  minutes: 24
credits: Conceived and edited by Nikolai Krivous. Drafted by Claude Opus 5.5.
---

## Authority versus influence

Formal authority comes with the job title. A manager sets priorities, a product manager decides what goes into a release, and the team carries out the decision even if nobody has persuaded them.

Influence works where there’s no reporting line. People accept someone else’s proposal of their own free will, because they trust its author or see something in it for themselves.

|  | Authority | Influence |
| --- | --- | --- |
| Where it comes from | The job title | How other people see the person |
| How it sounds | “We’re doing it this way” | “Here’s what I suggest, and here’s what’s in it for you” |
| Who it works on | Direct reports | Anyone who trusts the author, including people on other teams |
| What it costs | Give orders too often and people stop trying | Every request spends trust, and every kept promise earns it back |
| What happens when the person changes roles | It’s gone | It stays, as long as the same people are around |

Managers have to rely on influence too. A manager who too often settles things by giving orders ends up with people who do exactly what they’re told and nothing more. That’s why good managers rarely give orders.

Influence is always tied to particular people and a particular subject. An engineer can carry a lot of weight with their own team on database questions and almost none with the product manager on priorities. So whenever influence comes up, the question is over whom, and on what.

## Being right isn’t the same as winning people over

Engineers are used to arguments that end in proof. Code compiles or it doesn’t, a test passes or fails, and nobody argues with the result. Decisions that people make don’t work that way.

When someone hears a proposal, they judge more than the idea. Almost without noticing, they ask themselves three questions:

1. Does this person know what they’re talking about?
2. Why are they proposing this, for the work’s sake or their own?
3. What will saying yes cost me?

Being right answers only the first question. Trust answers the second. The listener has to be sure the author is working toward a shared outcome. The answer to the third depends on how the proposal is structured and how much work and risk it shifts onto whoever agrees. Until those two questions get good answers, even the most accurate technical argument falls flat.

> Amy joined a new team as a senior engineer, and in her third week she was caught up in a bad release. A new feature broke payments, and the team spent the whole day rolling everything back. At the retro, Amy said what seemed obvious to her: new features should ship behind feature flags, switches that let the team turn off any feature in a minute without a rollback. At her last job, everyone did it that way.
>
> She was right about flags, and the team knew it. But Ian, the team’s manager, heard more than the idea. What he saw was a new hire telling the team how to do their jobs in her first month, and he couldn’t tell whether she cared about releases or wanted to make a name for herself. Her proposal also came with a flag system that someone would have to build, and the team was already short of people that quarter. Ian said now wasn’t the time and moved on to the next item.
>
> Amy had proved she knew flags. She hadn’t explained why she was proposing them or what agreeing would cost the team.

## Where influence comes from

Influence is made up of expertise, relationships and track record. Each one is built up and spent independently of the others. None of them matters most, and none can stand in for the other two.

### Expertise

A person has expertise when others see them as someone who knows the subject. People listen to their opinion on the database because they’ve fixed it in production three times.

Expertise grows when others see a person solve hard problems, explain things clearly, and back their ideas with prototypes and numbers.

Expertise has two limits. It’s tied to a subject. In arguments about the product, the team’s best Kubernetes expert carries no more weight than anyone else. And it doesn’t move with the person, so at a new company it has to be proven all over again. Expertise also convinces people that the author is right, but it doesn’t tell them why they should go along.

### Relationships

When relationships are good, people are sure the person is on their side. When that person proposes a change, nobody looks for a catch.

Relationships grow stronger when someone helps others with their goals, takes an interest in what matters to them, drops by to chat with colleagues for no particular reason, and remembers to give public credit to anyone who has done good work.

Relationships only ever exist with specific people. Trust earned in one team counts for nothing with the team next door. And relationships are easy to damage. All it takes is for someone to feel used.

Engineers often write relationships off as politics and don’t spend time on them. But the listener asks “why are they proposing this?” before “are they right?”

### Track record

A track record is what people remember about someone: how their forecasts turned out and whether they kept their promises. Expertise says “they know”. A track record says “they’ve been right before”.

A track record grows when someone writes a forecast down in advance and it comes true, when they meet the deadlines they named, and when they’re the first to admit their own mistakes.

A track record lives in people’s memories, and memories are short. A forecast that nobody wrote down is forgotten within six months.

> A week after that retro, Oliver, who was in his fourth year on the team, suggested moving the slow tests to an overnight run. He had one argument: daytime builds would be faster. Ian agreed without asking a single question.
>
> Amy was stung. Her proposal had been better thought through, yet hers was the one that got turned down. Later she worked out the difference. She did have expertise. At her last job she had built a flag system herself, but nobody here knew that. Three weeks wasn’t long enough to build relationships, and she had no forecasts here that had come true yet. Oliver had all three. He had helped Ian get more than one tough release over the line, and two years earlier he had warned about a database problem that later really did surface.

## What trust is made of

All three sources of influence rest on trust. A useful way to analyse trust is the [trust equation](https://trustedadvisor.com/?p=16765) from *The Trusted Advisor* (David Maister, Charles Green, Robert Galford, 2000). The book was written for consultants, but an engineer without authority is in the same boat. All they can do is advise.

```latex
T = \frac{C + R + I}{S}
```

| What’s in the equation | What the other person asks themselves | What it looks like in practice |
| --- | --- | --- |
| C, credibility | Can I believe what they say? | Gives exact numbers, and when unsure says “I don’t know, I’ll check” |
| R, reliability | Do they do what they promise? | Finishes reviews on time and warns early if a date is going to slip |
| I, intimacy | Can I bring them a problem and not regret it? | Answers a junior’s question without mocking them and doesn’t drag someone’s mistake into the team channel |
| S, self-orientation | Who are they doing this for? | Says “I told you so”, argues to win, makes proposals that mostly benefit themselves |

### The more self-focused someone is, the less they’re trusted

Credibility, reliability and intimacy add up, and self-orientation divides the total. That’s why a brilliant expert who is visibly more interested in their own success is often trusted less than an average engineer who cares about the team’s results.

Others spot self-orientation at once, while the person themselves usually doesn’t. It most often shows up in one of these ways:

- the argument goes on after the difference between the options has stopped mattering;
- jargon turns up where plain words would do;
- a technical argument covers for personal interest. Someone says “that’s technically wrong” when really they just don’t want to do the work.

Personal interests are best raised separately. A conversation about a decision should stay about the decision, and personal goals and workload get a conversation of their own. A stated interest shrinks the denominator, and a hidden one makes it bigger.

> After the episode with the tests, Amy asked Oliver how her retro pitch had come across. He was honest: “Like you’d come to teach us how it’s done.” And it wasn’t only that one retro. Amy had raised flags at two more meetings with the same arguments. When Ian said no a second time, she announced in front of everyone that she’d run it past his boss.
>
> All of this told the team the same thing: being right mattered more to Amy than helping. It didn’t make her any less of an expert on flags. But everything she knew and could do was now divided by a large denominator.

## Trust capital

Trust capital is how far people will take someone at their word without full proof. When someone has a lot of it, their proposals go ahead without a pilot, they get time for experiments with uncertain outcomes, and their mistakes are forgiven.

It helps to picture it as a bank account. Stephen Covey popularised the metaphor in *The 7 Habits of Highly Effective People*, where he calls it the “emotional bank account”. Every action is either a deposit or a withdrawal.

### How the account works

- There’s a separate account with each person. A large balance with the team lead counts for nothing in a conversation with the head of product. There’s no such thing as a company-wide balance.
- The account is tied to a subject. People may fully trust someone’s choice of library and still doubt their time estimates.
- Withdrawing is easier than depositing. A month of kept promises can be undone by one remark, such as mocking someone’s estimate in front of the whole team at sprint planning.

### Deposits and withdrawals

| What counts as a deposit | What counts as a withdrawal |
| --- | --- |
| A kept promise, including a small one, such as reviewing a PR on the promised day | A proposal without data, resting on “just trust me” |
| A written forecast that later came true | Arguing with a decision that’s already been made |
| Helping someone with their goal | Asking people to invest again after a failure |
| Being the first to own up to a mistake | Escalation, especially going over someone’s head |
| Backing a decision despite disagreeing with it | Turning down someone’s request |
| Thanking colleagues publicly for their work | A flat statement that later turned out to be wrong |

### What trust capital is for

Capital exists to be spent. Saved-up trust can get someone onto a more interesting project, help them defend an engineering decision, or buy time for a risky idea. An engineer who never argues and never asks for any of this isn’t using their influence.

### How capital goes to waste

Spending it carelessly is also a mistake. Capital drains away unnoticed, usually in one of two ways:

1. Spending it on things that don’t matter, like an argument about a variable name or ten nitpicks in every review. When the important argument comes along, the account is empty.
2. Spending it without knowing the balance, which means asking a lot of someone before building any trust with them.

Before starting an argument, it helps to ask whether it will matter in six months and whether it’s worth making the next argument with this person harder.

### How to read the balance

The balance can’t be measured directly, but a few signs give it away:

- how much proof people want from the person before agreeing;
- whether people come to them for advice unprompted;
- whether they’re invited to discuss a decision before it’s made, or told about it afterwards;
- whether people readily agree to try their ideas.

> For the next two months, Amy didn’t bring up flags. She finished reviews on the day she’d promised, and when she couldn’t, she warned people in advance. She helped Laura, the QA engineer, automate the payment check that Laura had been running by hand before every release. When her own migration took down the test environment, she was the first to post about it in the team chat and explained what had gone wrong. And instead of leaving ten style comments in every review, she suggested the team agree on the rules once and let a linter enforce them.
>
> The signs that her balance had grown appeared on their own. Oliver came to her for advice on how to split up a big task. Ian invited Amy to talk through next quarter’s plan before he showed it to the team.

## Why people who are right go unheard

Influence without being right is dangerous, because it can persuade a team to go the wrong way. So being right matters. But people who are right often go unheard too, usually for one of four reasons.

1. The two sides care about different things. The engineer counts technical costs, while the manager cares about the release date and what they’ll present at the quarterly review. Both are right by their own numbers, but each starts from what matters to them.
2. Changing course costs more than the mistake. The decision has already been cleared with legal, promised to a client or shown to leadership, so reopening it is expensive even if it’s a bad one.
3. Being right comes across as winning. “We’re doing it wrong” casts the other person as the loser, and for them, agreeing means admitting a mistake.
4. The right call was never written down. Someone raised a warning out loud. Six months later the forecast came true, and nobody remembers that they made it. The call stayed in their head and never reached their track record.

### How a lost argument can still earn trust

A lost argument can also build trust, if three conditions are met.

1. The position is written down before the decision, briefly and calmly. For example: “I suggest X. The risk with Y is Z. Let’s check in six months against metric M.” It can go in an ADR (architecture decision record) or in a comment next to the decision.
2. After losing, the person backs the decision and carries it out as well as they would their own.
3. If the forecast comes true, they help deal with the consequences first, then suggest how to keep it from happening again, and they don’t remind anyone that they were right. People will find the written record themselves, and they’ll remember the restraint.

Then the lost argument adds to the person’s track record, because they turned out to be right, and to their relationships, because they didn’t get in the way or gloat. But pushing after the decision has been made spends capital, even when the person is right.

> In spring, the team started work on a new shopping cart. Marketing had already been promised a release date in time for a big sale, and Ian decided to ship the whole cart in a single release. Amy thought it should go out in parts. But this time she didn’t say the plan was wrong. She asked what would happen if a rollback took a day right in the middle of the sale. They talked it through but kept the date.
>
> So Amy left a short comment on the plan: “I suggest shipping the cart in parts. If something breaks, rolling back one big release will take a day. Let’s see what the first incident shows.” Then she built her part of the cart to Ian’s plan as well as she could.
>
> On the second day of the sale, the cart broke. For the nine hours the rollback took, Amy worked alongside everyone else and didn’t mention her forecast. She held her suggestions for the postmortem, where she brought a plan for shipping the remaining parts one at a time, and she never once said “I told you so”.

## Getting to yes

Pushing a specific decision through comes down to seven steps. Only the first two are about the idea itself. The other five make agreeing cheap and safe.

1. Find out who makes the decision and what matters to them right now. Every decision-maker has goals for the quarter and things they’ll be judged on.
2. Frame the proposal around their goal. “It’s considered best practice” persuades no one. First name the problem, then how it gets in the way of their goal, and only then the proposal.
3. Find out what’s stopping them from agreeing. Usually it’s a shortage of people, fear of risk, missing knowledge or a different priority.
4. Make agreeing cheaper by removing the specific blocker that came up. The smaller the ask, the less pushback it gets and the less often it collides with someone else’s priorities.
5. Talk the idea through with the people it affects before going to the decision-maker, and work in their suggestions. People back what they helped create, and a decision-maker finds it harder to say no to several people than to one.
6. Propose a time-boxed trial and agree in advance on when to stop. Uncertainty scares decision-makers, and when the worst case is named up front, saying yes is easier. And when the stop condition comes from the author, it shows they care about the result rather than their own idea.
7. Accept the outcome and write it down. If the answer is yes, do the work and report honestly on the result, good or bad. If it’s no, record the position and the reason for the refusal. The question can be reopened once that reason loses its force.

> After the cart incident, Amy came back to flags, but she didn’t start with a retro. First she talked to Ian one-on-one and asked what mattered to him this quarter. It turned out he was expected to ship twice as often, and every long rollback threw his whole schedule off.
>
> So Amy pitched flags in terms of what mattered to Ian. With flags, a bad feature could be switched off in a minute, so releases could go out more often without fear of long rollbacks. Ian gave the same answer as six months earlier: there was nobody to build a flag system. Then Amy offered to start with the next two features and set everything up herself, which would take two days.
>
> Before the meeting at which Ian would decide, Amy showed the plan to Laura and Oliver. Laura asked for all flags to be on by default in the test environment, since otherwise she’d have to switch them all on by hand. Amy added that to the plan. She came to the meeting with a stop condition: “We’ll try it until the end of the month. If the flags don’t spare us a single rollback, we take them out and drop the subject for good. And if you decide sooner that they’re getting in the way, we stop straight away, no arguments.” Amy took on all the work and left Ian the right to stop the experiment.
>
> Ian agreed. Three weeks later one of the two features had to be switched off, and it took a minute instead of a whole day of rolling back. Amy put that in her report. She also wrote that setting up the flags had taken her longer than planned, three days instead of two.

## When the steps need adjusting

The steps above work most of the time. But three situations call for adjusting them: when someone has just joined the team, when agreement has to come from another team, and when the person making the decision can’t say yes.

### New to the team

A newcomer starts with a balance close to zero. Nobody on the new team has seen their past work, and “at my last company we did it this way” carries almost no weight. That was exactly the argument Amy leaned on at her first retro. In the first weeks, influence has to be built differently.

- Questions work better than statements. “What happens if the load doubles?” gets further than “this won’t handle the load”, because the other person reaches the conclusion on their own and then treats the decision as theirs.
- The newcomer can be wrong too. The team may have reasons the newcomer doesn’t know about yet, and questions guard against that mistake as well.
- It’s better to talk to the person behind a decision in private. In the first weeks, objecting in a group meeting costs more.
- At first, capital builds up through small things: quick wins, kept promises and help with other people’s work.

### Working with another team

Another team has its own lead and its own roadmap, and it doesn’t owe anyone help. This is where influence faces its real test, and where the line between senior and staff engineers is drawn. Inside one team, people share goals. Between teams, they don’t.

The first step is to find out what’s keeping the other team from agreeing. The answer determines what to bring them.

| What’s in the way | What to bring |
| --- | --- |
| They’re short of people | An offer to do the work, with them reviewing it |
| Risk to their system | An option that affects only one team at first, plus a rollback plan |
| The system is too complex to understand and change quickly | A direction for the solution and a request for an hour of pairing |
| A different priority | First, the smallest possible version of the ask. If that doesn’t work, a joint escalation with their lead |

Two rules follow from this. The first is that code gets written only after the direction is agreed. Otherwise it’s work on someone else’s system behind its owners’ backs, and the owners will most likely refuse to accept that code. The second is that escalation settles a clash of priorities but doesn’t make up for missing knowledge. When knowledge is missing, the answer is to ask.

> The flags caught on, and Amy wanted to store them in the configuration service owned by the platform team. The platform lead replied that their roadmap was full and they wouldn’t get to it before next quarter. Amy had access to their repository and could have written what she needed herself.
>
> Instead, she asked what was holding them back. The answer was risk. Every team depended on that service, and any mistake would hit all of them at once. Amy proposed a separate namespace just for her team and a rollback plan, offered to do all the work herself, and asked them only for a review. They agreed on the direction in an hour-long call, and only then did Amy write the code. No escalation was needed.

### When influence can’t help

Influence can change what people want, but not what they’re able to do. If the decision-maker has no budget, authority or right to say yes, no argument will help. A few signs give this situation away:

- the goalposts keep moving. As soon as one condition is met, the next one appears;
- the people making the decision keep changing;
- saying yes does the decision-maker no good personally.

Pushing in this situation is pointless. It drains capital and achieves nothing. It makes more sense to find a sponsor, someone who wants the same outcome and has the power to make it happen, or to move to a different team or company. Spotting a dead end in time is also part of the skill of influence.

> Six months later, Amy proposed moving the whole department onto flags. The department head called it a good idea and asked for a cost estimate. By the time the estimate was ready, the department head had been replaced. The new one asked for a pilot in two more teams. The pilot went well, but by then the department’s budget had been frozen until next year, and a new condition appeared: get sign-off from the architecture review board.
>
> Amy recognised the signs and stopped carrying the proposal from meeting to meeting. She found the head of a neighbouring division who had the same rollback headaches and the freedom to make his own calls, and started with his teams.

## Further reading

| Source | Why read it |
| --- | --- |
| [Tanya Reilly, The Staff Engineer’s Path](https://www.oreilly.com/library/view/the-staff-engineers-path/9781098118723/) | A book on how an engineer without authority leads projects and people |
| [Will Larson, Staff Engineer: Leadership beyond the management track](https://staffeng.com/book) | How to work with leadership and sponsors. Some of the guides are free on staffeng.com |
| [Will Larson, Staff engineer archetypes](https://lethain.com/staff-engineer-archetypes/) | Four shapes a staff engineer’s influence takes (Tech Lead, Architect, Solver, Right Hand) |
| [Maister, Green, Galford, The Trusted Advisor (the trust equation)](https://trustedadvisor.com/?p=16765) | Where the trust equation comes from and why self-orientation destroys trust |
| [Tanya Reilly, Being Glue (talk summary)](https://threadreaderapp.com/thread/1025043287311372288.html) | How glue work builds influence even when it doesn’t get counted |
| [Julia Evans, Get your work recognized: write a brag document](https://jvns.ca/blog/brag-documents/) | How to keep a track record from getting lost by writing down the work and what it changed |
