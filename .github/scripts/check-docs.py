#!/usr/bin/env python3
import os
import re
import subprocess
import sys
from urllib.parse import unquote

SKIPPED_MARKDOWN = ('blog/src/posts/',)
SPEC_FILE = re.compile(r'(?:^|/)docs/specs/(\d+)-[^/]+\.md$')
REQUIREMENT = re.compile(r'^(?:[-*+]|\d+[.)])\s+`?(\d+-\d+)(?![\w-])')
ID = re.compile(r'\d+-\d+')
FENCE = re.compile(r'^\s*(`{3,}|~{3,})')
HEADING = re.compile(r'^#{1,6}\s+(.*?)\s*#*\s*$')
LINK = re.compile(r'!?\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^()\s]+)(?:\s+"[^"]*")?\)')
CODE_SPAN = re.compile(r'(`+)(.+?)\1')
SCHEME = re.compile(r'^[a-zA-Z][a-zA-Z0-9+.-]*:')
MENTION = re.compile(r"((?:`\d+-\d+`(?:,\s*|,?\s+(?:and|or)\s+)?)+)\s*(?:of|in)\s+(?:[\w'’.-]+\s+){0,3}$")
TEST_CALL = re.compile(r'''(?<![\w.$])(?:it|test)((?:\.\w+)*)\(\s*(['"`])''')
RUNNING_MODIFIERS = {'only', 'concurrent', 'sequential'}
SKIPPING_MODIFIERS = {'skip', 'fixme', 'fail', 'fails', 'todo'}
LEADING_IDS = re.compile(r'\d+-\d+(?![\w-])(?:[\s,]+\d+-\d+(?![\w-]))*')
CELL_IDS_NAME = re.compile(r'\$\{[^}]*\bids\b')
SHELL_COMMAND = re.compile(r'''^[ \t]*([\w-]+)[ \t]+['"]?(.*)$''', re.M)
TEST_FILE = re.compile(r'^(\d+-[^.]+)\.(?:.*\.)?(?:ts|js|sh)$')
CELL_IDS = re.compile(r'''\[\s*((?:['"]\d+-\d+['"]\s*,?\s*)+)\]''')

errors = []


def error(path, line, message):
    errors.append((path, line, message))


def repository_files():
    listed = subprocess.run(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
        capture_output=True, check=True,
    ).stdout.decode()
    return sorted({path for path in listed.split('\0') if path and os.path.isfile(path)})


def folders_of(files):
    folders = set()
    for path in files:
        folder = os.path.dirname(path)
        while folder:
            folders.add(folder)
            folder = os.path.dirname(folder)
    return folders


def prose_lines(path):
    fence = None
    with open(path, encoding='utf-8') as text:
        for number, line in enumerate(text, 1):
            opening = FENCE.match(line)
            if fence:
                if opening and opening.group(1)[0] == fence[0] and len(opening.group(1)) >= len(fence):
                    fence = None
                continue
            if opening:
                fence = opening.group(1)
                continue
            yield number, line.rstrip('\n')


def slug(heading):
    text = LINK.sub(lambda link: link.group(1), heading).lower()
    text = re.sub(r'[^\w\- ]', '', text)
    return text.replace(' ', '-')


def anchors_of(path, cache={}):
    if path not in cache:
        seen = {}
        anchors = set()
        for _, line in prose_lines(path):
            heading = HEADING.match(line)
            if heading:
                base = slug(heading.group(1))
                count = seen.get(base, 0)
                seen[base] = count + 1
                anchors.add(base if count == 0 else f'{base}-{count}')
        cache[path] = anchors
    return cache[path]


def requirements_of(path, cache={}):
    if path not in cache:
        file_number = SPEC_FILE.search(path).group(1)
        found = {}
        for number, line in prose_lines(path):
            requirement = REQUIREMENT.match(line)
            if not requirement:
                continue
            if requirement.group(1).split('-')[0] != file_number:
                error(path, number, f'{requirement.group(1)} has the number of another specification file')
            else:
                found[requirement.group(1)] = number
        cache[path] = found
    return cache[path]


def code_spans(line):
    return [(span.start(), span.end()) for span in CODE_SPAN.finditer(line)]


def inside(position, spans):
    return any(start <= position < end for start, end in spans)


def resolve(source, target, files, folders):
    path = unquote(target)
    if path.startswith('/'):
        resolved = path.lstrip('/')
    else:
        resolved = os.path.normpath(os.path.join(os.path.dirname(source), path))
    resolved = resolved.rstrip('/')
    if resolved in files or resolved in folders or resolved in ('', '.'):
        return resolved
    return None


def check_mentions(source, number, before, target_path, target_text):
    mention = MENTION.search(before)
    if not mention:
        return
    known = requirements_of(target_path)
    for requirement in ID.findall(mention.group(1)):
        if requirement not in known:
            error(source, number, f'`{requirement}` of [{target_text}] is not a requirement of {target_path}')


def check_markdown(path, files, folders):
    for number, line in prose_lines(path):
        spans = code_spans(line)
        previous_end = 0
        for link in LINK.finditer(line):
            if inside(link.start(), spans):
                continue
            text, target = link.group(1), link.group(2)
            before = line[previous_end:link.start()]
            previous_end = link.end()
            if SCHEME.match(target) or target.startswith('<'):
                continue
            target_path, _, anchor = target.partition('#')
            resolved = path if target_path == '' else resolve(path, target_path, files, folders)
            if resolved is None:
                error(path, number, f'the link to {target} leads to no file or folder')
                continue
            if anchor and resolved.endswith('.md') and resolved in files and anchor not in anchors_of(resolved):
                error(path, number, f'the link to {target} leads to no heading of {resolved}')
            if SPEC_FILE.search(resolved):
                bare = text.strip('`')
                if ID.fullmatch(bare):
                    if bare not in requirements_of(resolved):
                        error(path, number, f'the link [{text}] names no requirement of {resolved}')
                else:
                    check_mentions(path, number, before, resolved, text)


def specification_roots(files):
    roots = {}
    for path in files:
        spec = SPEC_FILE.search(path)
        if spec:
            root = path[:spec.start()].rstrip('/')
            roots.setdefault(root, []).append(path)
    return roots


def owning_root(path, roots):
    folder = os.path.dirname(path)
    while True:
        if folder in roots:
            return folder
        if not folder:
            return None
        folder = os.path.dirname(folder)


def referenced_ids(path):
    with open(path, encoding='utf-8') as text:
        source = text.read()
    ids = {}

    def line_of(offset):
        return source.count('\n', 0, offset) + 1

    def add(match_ids, offset, runs=True):
        for requirement in ID.findall(match_ids):
            line, ran = ids.get(requirement, (line_of(offset), False))
            ids[requirement] = (line, ran or runs)

    if path.endswith('.sh'):
        commands_with_ids = set()
        without_ids = []
        for command in SHELL_COMMAND.finditer(source):
            leading = LEADING_IDS.match(command.group(2))
            if leading:
                commands_with_ids.add(command.group(1))
                add(leading.group(0), command.start())
            else:
                without_ids.append(command)
        for command in without_ids:
            if command.group(1) in commands_with_ids:
                error(path, line_of(command.start()), f'the first argument of this {command.group(1)} starts with no requirement ID')
    else:
        for call in TEST_CALL.finditer(source):
            modifiers = set(call.group(1).split('.')) - {''}
            if not modifiers <= RUNNING_MODIFIERS | SKIPPING_MODIFIERS:
                continue
            name = source[call.end():]
            if call.group(2) == '`' and CELL_IDS_NAME.match(name):
                continue
            leading = LEADING_IDS.match(name)
            if leading:
                add(leading.group(0), call.start(), runs=not modifiers & SKIPPING_MODIFIERS)
            else:
                error(path, line_of(call.start()), 'the name of this test starts with no requirement ID')
    for cell in CELL_IDS.finditer(source):
        add(cell.group(1), cell.start())
    return ids


def check_tests(files):
    roots = specification_roots(files)
    tested = {}
    for path in sorted(files):
        if '/tests/' not in f'/{path}':
            continue
        name = TEST_FILE.match(os.path.basename(path))
        if not name:
            continue
        base = name.group(1)
        root = owning_root(path, roots)
        spec = None if root is None else os.path.join(root, 'docs/specs', f'{base}.md')
        if spec not in files:
            error(path, 1, f'this test file is named after {base}.md, which is no specification file of its project or module')
            continue
        file_number = base.split('-')[0]
        known = requirements_of(spec)
        for requirement, (line, runs) in referenced_ids(path).items():
            if requirement.split('-')[0] != file_number:
                error(path, line, f'{requirement} is not a requirement of {spec}, which this file tests')
            elif requirement not in known:
                error(path, line, f'{requirement} is not a requirement of {spec}')
            elif runs:
                tested.setdefault(spec, set()).add(requirement)
    for spec_files in roots.values():
        for spec in spec_files:
            for requirement, line in requirements_of(spec).items():
                if requirement not in tested.get(spec, set()):
                    error(spec, line, f'{requirement} has no test: no test file named after {os.path.basename(spec)} holds it at the start of the name of a test that runs, at the start of the first argument of a shell command or in an array of IDs')


def main():
    files = set(repository_files())
    folders = folders_of(files)
    for path in sorted(files):
        if path.endswith('.md') and not path.startswith(SKIPPED_MARKDOWN):
            check_markdown(path, files, folders)
    check_tests(files)
    for path, line, message in errors:
        print(f'{path}:{line}: {message}')
    for path, line, message in errors:
        print(f'::error file={path},line={line}::{message}')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
