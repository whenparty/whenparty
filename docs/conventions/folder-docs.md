# Folder documents

These rules apply to every `AGENTS.md` and `README.md` and to the documents on how to work in a folder, in addition to the [writing rules](/docs/conventions/writing.md). The [map](/AGENTS.md) says which folders must have an `AGENTS.md` or a `README.md`; [Where knowledge goes](#where-knowledge-goes) says when another folder gets an `AGENTS.md`.

## AGENTS.md

An `AGENTS.md` is a map for agents. Every `AGENTS.md`, from the root to a [module](/docs/glossary.md#module), has these parts and no others, apart from the ones that the next paragraph adds:

- a paragraph that says what its folder is;
- a map of the other documents of the folder, of its parts that have their own documentation, such as [subprojects](/docs/glossary.md#subproject) and modules, and of the decision records about its code, with what each holds and which files or tasks it covers, so that an agent can tell which of them a task needs; a folder with neither has no map.

The root `AGENTS.md` also says which folders must have an `AGENTS.md` or a `README.md`, where each kind of document lives, which conventions file covers which files and where a rule lives, and which documents to read before any change. Other conventions files can add parts: the specification rules add, in a project's `AGENTS.md`, which of its parts need a specification, and in the `AGENTS.md` of a project or module, the list of relying requirements.

Every `AGENTS.md` other than the root is on the map of the nearest folder above it that has an `AGENTS.md`, so the maps form one tree from the root.

The other documents that the map links to, apart from the specification, the decision records and the `AGENTS.md` of its parts, say how to work in the folder: its key files, architecture constraints, the commands and checks for changing its code, how to set up, deploy, run, use and troubleshoot what it holds, and what the code cannot express but you need to know to change it.

## README.md

A README is a short text for people. It says what its folder holds and how it works, and has no rules, instructions or commands. People change this repository through agents, and agents take their rules and instructions from `AGENTS.md` and the documents it links to, not from READMEs. A README may describe what the folder's `AGENTS.md` and the documents it links to also describe. When a README differs from `AGENTS.md`, another document or the code, the README is wrong. A change that makes a README differ fixes it, and a README found to differ is fixed in the change that finds it.

## Where knowledge goes

Behaviour goes in the specification, when there is one, as the [specification rules](/docs/conventions/specs.md) say; the reason for a choice that needs a decision record goes in that record, as the [decision record rules](/docs/conventions/decisions.md) say. What you need to know to change, set up, deploy, run, use or troubleshoot what a folder holds goes in a document in or below the `docs/` of the nearest folder that has an `AGENTS.md`, that folder itself or one above it, other than the root, and that folder's `AGENTS.md` links to it. When no folder between the code and the root has an `AGENTS.md`, the innermost project or module that contains the code gets one, or, outside projects, its top-level folder, such as `.github/`. Knowledge about code in several folders goes in a document of the nearest folder with an `AGENTS.md` above all of it, other than the root. When there is none, it goes where knowledge about the code that must change goes, as above, and the `AGENTS.md` that covers the other code, added as above if needed, also links to it. Knowledge about files in the root itself goes in a document in the root `docs/` that the root `AGENTS.md` links to. Setup outside the repository, such as the VPS, Cloudflare or GitHub secrets, goes with the folder whose code relies on it.
