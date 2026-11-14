#!/bin/sh
. "$(dirname "$0")/proxy.sh"

echo_stub games-tictactoe
echo_stub index
echo_stub signaling 8080
proxy_start

check '4-1 a title gets its path without the prefix' "$(request games.when.party /tictactoe/a)" 200
check_contains '4-1 a title gets its path without the prefix' "$(body)" 'games-tictactoe games.when.party /a|'
request games.when.party '/tictactoe/a%20b%3Fc%2Fd%41?x=%2F1&y' >/dev/null
check_contains '4-1 the path is encoded again and the query is unchanged' "$(body)" ' /a%20b%3Fc/dA?x=%2F1&y|'
request games.when.party /tictactoe/ >/dev/null
check_contains '4-1 the root of a title' "$(body)" 'games-tictactoe games.when.party /|'
request games.when.party '/tictactoe//a/./b' --path-as-is >/dev/null
check_contains '4-1 the path is normalized' "$(body)" 'games-tictactoe games.when.party /a/b|'
request games.when.party /tictactoe/../favicon.ico --path-as-is >/dev/null
check_contains '4-1 a path that leaves the title goes elsewhere' "$(body)" 'index games.when.party '

check '4-2 a segment without a slash redirects' "$(request games.when.party /tictactoe)" 301
check '4-2 a segment without a slash redirects' "$(header location)" 'https://games.when.party/tictactoe/'
request games.when.party '/tictactoe?room=K7MXQ' >/dev/null
check '4-2 the redirect keeps the query' "$(header location)" 'https://games.when.party/tictactoe/?room=K7MXQ'
request games.when.party /Tictactoe >/dev/null
check_contains '4-2 an upper-case segment is not a title' "$(body)" 'index games.when.party /Tictactoe|'

request games.when.party / >/dev/null
check_contains '4-3 the root goes to the index page' "$(body)" 'index games.when.party /|'
request games.when.party /_assets/a.css >/dev/null
check_contains '4-3 a path that is no segment goes to the index page' "$(body)" 'index games.when.party /_assets/a.css|'
request games.when.party /favicon.ico >/dev/null
check_contains '4-3 a file at the root goes to the index page' "$(body)" 'index games.when.party /favicon.ico|'

for path in /missing.txt /status-502.txt /status-504.txt /tictactoe/missing /tictactoe/status-502 /tictactoe/status-504 /nope/; do
  check "4-4 $path answers 404" "$(request games.when.party "$path")" 404
  check_contains "4-4 $path shows the games' 404 page" "$(body)" 'When Party games'
  check "4-4 $path is not cached" "$(header cache-control)" no-store
done

check '4-5 signaling.when.party goes to the signaling server' "$(request signaling.when.party /health)" 200
check_contains '4-5 signaling.when.party goes to the signaling server' "$(body)" 'signaling signaling.when.party /health|'
check '4-5 a 404 of the signaling server keeps its status' "$(request signaling.when.party /missing)" 404
check '4-5 a 404 of the signaling server keeps its body' "$(body)" 'stub 404'

stop index
check '4-4 a path of the index page answers 404 while it is down' "$(request games.when.party /)" 404
check_contains "4-4 a path of the index page shows the games' 404 page while it is down" "$(body)" 'When Party games'
stop signaling
check '4-5 signaling.when.party answers 502 while the server is down' "$(request signaling.when.party /health)" 502

finish
