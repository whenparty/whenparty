#!/bin/sh
set -eu

if [ $# -ne 2 ]; then
  echo "usage: $0 <post> <audio from NotebookLM>" >&2
  exit 64
fi

post=$1
source=$2
posts="$(cd "$(dirname "$0")/.." && pwd)/src/posts"
[ -d "$posts/$post" ] || { echo "no post folder $posts/$post" >&2; exit 1; }

dir=$(cd "$(dirname "$source")" && pwd)
encoded="$dir/$post.encoding.mp3"
ffmpeg -v error -y -i "$source" -map_metadata -1 -vn -c:a libmp3lame -b:a 96k "$encoded"

file="$post.$(shasum -a 256 "$encoded" | cut -c1-8).mp3"
mv "$encoded" "$dir/$file"
chmod 644 "$dir/$file"

bytes=$(wc -c < "$dir/$file" | tr -d ' ')
duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dir/$file")
seconds=$(awk -v s="$duration" 'BEGIN { print int(s + 0.5) }')

echo "scp '$dir/$file' blog-audio:/opt/services/whenparty/blog/audio/"
printf 'audio:\n  file: %s\n  bytes: %s\n  seconds: %s\n' "$file" "$bytes" "$seconds"
