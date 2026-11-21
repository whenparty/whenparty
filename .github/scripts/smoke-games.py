#!/usr/bin/env python3
import base64
import html.parser
import http.client
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROXY_CONFIGS = ROOT / 'infra/nginx/conf.d'
GAMES_HOST = 'games.when.party'
SIGNALING_HOST = 'signaling.when.party'
TITLE_PATH = re.compile(r'^/[a-z0-9-]+/')
CSS_URL = re.compile(r'''url\(\s*['"]?([^'")]+)['"]?\s*\)''')
SCRIPT_PATH = re.compile(r'''["'`](\.?/[\w./-]*\.[a-z0-9]+)["'`]''')
SCRIPT_TYPES = ('text/javascript', 'application/javascript')
USER_AGENT = 'whenparty-deploy-smoke'
ATTEMPTS = 7
PAUSE_SECONDS = 5
TIMEOUT_SECONDS = 10


def added_headers(text, indent):
    return re.findall(rf'^{indent}add_header (\S+) "([^"]*)" always;$', text, re.M)


def server_block(config, host):
    for block in config.split('\nserver {')[1:]:
        block = block.split('\n}')[0]
        if f'server_name {host};' in block:
            return block
    sys.exit(f'games.conf has no server for {host}')


def proxy_headers(host):
    shared = added_headers((PROXY_CONFIGS / 'default.conf').read_text(), '')
    own = added_headers(server_block((PROXY_CONFIGS / 'games.conf').read_text(), host), '    ')
    return dict(shared + own)


def header_failures(url, headers, expected):
    failures = []
    for name, value in expected.items():
        values = headers.get_all(name) or []
        if values != [value]:
            failures.append(f'{url}: {name} is {values}, expected [{value!r}]')
    return failures


def bypass_cache(url, token):
    parts = urllib.parse.urlsplit(url)
    query = urllib.parse.urlencode([*urllib.parse.parse_qsl(parts.query), ('smoke', token)])
    return urllib.parse.urlunsplit(parts._replace(query=query))


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()


class References(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.found = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ('src', 'href') and value:
                self.found.append(value)


def references(content_type, body):
    text = body.decode('utf-8', 'replace')
    if content_type == 'text/html':
        parser = References()
        parser.feed(text)
        return parser.found
    if content_type == 'text/css':
        return CSS_URL.findall(text)
    if content_type in SCRIPT_TYPES:
        return SCRIPT_PATH.findall(text)
    return []


def crawl(start, belongs, token):
    expected = proxy_headers(GAMES_HOST)
    failures = []
    queue = [urllib.parse.urljoin(f'https://{GAMES_HOST}', start)]
    seen = set(queue)
    while queue:
        url = queue.pop(0)
        try:
            status, headers, body = get(bypass_cache(url, token))
        except OSError as error:
            failures.append(f'{url}: {error}')
            continue
        if status != 200:
            failures.append(f'{url}: answered {status}')
            continue
        failures += header_failures(url, headers, expected)
        for reference in references(headers.get_content_type(), body):
            target = urllib.parse.urldefrag(urllib.parse.urljoin(url, reference)).url
            parts = urllib.parse.urlsplit(target)
            if parts.scheme == 'https' and parts.netloc == GAMES_HOST and belongs(parts.path) and target not in seen:
                seen.add(target)
                queue.append(target)
    return failures, len(seen)


def websocket_status(path, origin):
    connection = http.client.HTTPSConnection(SIGNALING_HOST, timeout=TIMEOUT_SECONDS)
    try:
        connection.request('GET', path, headers={
            'User-Agent': USER_AGENT,
            'Origin': origin,
            'Connection': 'Upgrade',
            'Upgrade': 'websocket',
            'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': base64.b64encode(os.urandom(16)).decode(),
        })
        return connection.getresponse().status
    finally:
        connection.close()


def check_signaling(_token):
    failures = []
    url = f'https://{SIGNALING_HOST}/health'
    try:
        status, headers, _ = get(url)
        if status != 200:
            failures.append(f'{url}: answered {status}')
        failures += header_failures(url, headers, proxy_headers(SIGNALING_HOST))
    except OSError as error:
        failures.append(f'{url}: {error}')
    socket_url = f'wss://{SIGNALING_HOST}/platform'
    try:
        status = websocket_status('/platform', f'https://{GAMES_HOST}')
        if status != 101:
            failures.append(f'{socket_url}: answered {status} to a WebSocket upgrade')
    except OSError as error:
        failures.append(f'{socket_url}: {error}')
    return failures, 2


def check_for(folder):
    parts = Path(folder).parts
    if parts[:2] == ('games', 'titles') and len(parts) == 3:
        prefix = f'/{parts[2]}/'
        return lambda token: crawl(prefix, lambda path: path.startswith(prefix), token)
    if folder == 'games/index':
        return lambda token: crawl('/', lambda path: not TITLE_PATH.match(path), token)
    if folder == 'games/platform/signaling':
        return check_signaling
    return None


def smoke(folder):
    if not (ROOT / folder / 'compose.yml').is_file():
        print(f'{folder}: removed, nothing to check')
        return True
    check = check_for(folder)
    if check is None:
        print(f'{folder}: no public check')
        return True
    for attempt in range(1, ATTEMPTS + 1):
        failures, checked = check(str(time.time_ns()))
        if not failures:
            print(f'{folder}: ok, {checked} checked')
            return True
        if attempt < ATTEMPTS:
            print(f'{folder}: {len(failures)} failed, trying again in {PAUSE_SECONDS} seconds')
            time.sleep(PAUSE_SECONDS)
    for failure in failures:
        print(f'::error::{folder}: {failure}')
    return False


def main(folders):
    results = [smoke(folder) for folder in folders]
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main(sys.argv[1:])
