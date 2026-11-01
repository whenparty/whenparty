# AGENTS.md and README

These rules apply to every `AGENTS.md` and `README.md`, in addition to the [writing rules](/docs/conventions/writing.md). The [map](/AGENTS.md) says which folders must have an `AGENTS.md` or a `README.md`; [Where knowledge goes](#where-knowledge-goes) says when another folder gets an `AGENTS.md`.

## AGENTS.md

Every `AGENTS.md`, from the root to a [module](/docs/glossary.md#module), has at least these parts:

- a paragraph that says what its folder is;
- a map of the other documents in the folder and of its parts that have their own documentation, such as [subprojects](/docs/glossary.md#subproject) and modules, with what each holds; a folder with neither has no map;
- how to work there: in the root, which workflow files to read and what you need to know to change the files in the root itself; elsewhere, the folder's key files, architecture constraints, the commands and checks for changing its code, for what is set up, deployed, run or used, how to do that and troubleshoot it, and what the code cannot express but you need to know to change it.

Other conventions files can add parts, such as the list of relying requirements in the specification rules.

## README.md

A README is a short text for people. It says what its folder holds and how it works, and has no rules, instructions or commands. People change this repository through agents, and agents take their rules and instructions from `AGENTS.md` and the documents it links to, not from READMEs. A README may describe what the folder's `AGENTS.md` also describes. When a README differs from `AGENTS.md`, another document or the code, the README is wrong. A change that makes a README differ fixes it, and a README found to differ is fixed in the change that finds it.

## Where knowledge goes

Behaviour goes in the specification, when there is one, as the [specification rules](/docs/conventions/specs.md) say; the reason for a choice that needs a decision record goes in that record, as the [decision record rules](/docs/conventions/decisions.md) say. What you need to know to change, set up, deploy, run, use or troubleshoot what a folder holds goes in the `AGENTS.md` of that folder or the nearest folder above it that has one, other than the root, or in a document that it links to. When the root one is the only `AGENTS.md` there, the innermost project or module that contains the code gets one, or, outside projects, its top-level folder, such as `.github/`. Knowledge about code in several folders goes in the nearest `AGENTS.md` above all of it, other than the root one. When there is none, the note goes in the `AGENTS.md` for the code that must change when the other code changes, and the `AGENTS.md` for the other code, added as above if needed, links to it. Knowledge about files in the root itself goes in the root `AGENTS.md`. Setup outside the repository, such as the VPS, Cloudflare or GitHub secrets, goes with the folder whose code relies on it.
