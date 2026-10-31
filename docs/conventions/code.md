# Code

Do not write comments that explain anything in code, tests, configs or scripts. Make intent clear through names, types and structure. Rewrite unclear code before explaining it. What code cannot express belongs in the documentation, as the [map](/AGENTS.md) describes. A comment is allowed only when it is data or an instruction for a tool, such as the version next to a pinned commit SHA, a shebang or a linter directive. When you edit a file, move into the documentation what its other comments say that neither the code nor the documentation shows, and delete them.

Put a helper, style or asset in the folder of the only code that uses it. When code in another folder needs it too, move it to the closest folder that both are allowed to import from.
