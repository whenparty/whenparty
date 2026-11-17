# AI disclosure in the podcast

## Context

The audio version of a post is a conversation that NotebookLM generates from the post, with synthetic voices. Rule 1.11 of Apple's [content guidelines](https://podcasters.apple.com/support/891-content-and-subscription-guidelines), as of November 2026, asks creators who generate audio with AI to disclose it "in the content and metadata for each episode and show". The audio that NotebookLM makes does not say that it is generated. Podcast apps show the description of the show and of each episode, and lists of episodes show the start of it. An audio file is named after its hash and uploaded by hand, and a changed file is a new version with a new name, as [posts.md](../posts.md) says.

## Options

- In the descriptions only: the description of the show and the start of the description of each episode say that the audio is generated with AI in NotebookLM. The template adds it to every episode, and each file stays as NotebookLM made it. A listener who plays an episode without opening its description does not learn it, and Apple's review may read "content" as the audio and ask for a notice in it.
- Also a spoken notice at the start of each audio file. Every listener hears it, and it meets every reading of the rule. Each file needs an edit before the upload, and the published file needs a new version.

## Decision

In the descriptions only. They meet the metadata part of the rule with no work per episode, and the files stay as NotebookLM made them. A request from Apple's review for a notice in the audio is the reason to add one.

## Consequences

- [podcast.njk](../../src/podcast.njk).
- [podcast.md](../podcast.md).
