#!/bin/sh
set -eu

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "usage: $0 <post> <picture> <name> [<share name>]" >&2
  exit 64
fi

post=$1
picture=$2
dir="$(cd "$(dirname "$0")/.." && pwd)/src/posts/$post"
[ -d "$dir" ] || { echo "no post folder $dir" >&2; exit 1; }

report() {
  echo "$1 $(($(wc -c < "$dir/$1") / 1000)) KB"
}

width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$picture")
resize=
[ "$width" -le 1600 ] || resize="-resize 1600 0"
cwebp -quiet -q 80 -m 6 $resize "$picture" -o "$dir/$3.webp"
report "$3.webp"

[ $# -eq 4 ] || exit 0

frame=$(mktemp -d)/share.ppm
ffmpeg -v error -i "$picture" -frames:v 1 \
  -vf "crop=iw:round(iw*630/1200):exact=1,scale=1200:630:flags=lanczos" "$frame"
quality=80
while :; do
  cjpeg -quality "$quality" -optimize -progressive -outfile "$dir/$4.jpg" "$frame"
  [ "$(wc -c < "$dir/$4.jpg")" -ge 200000 ] || break
  quality=$((quality - 5))
done
rm -r "$(dirname "$frame")"
echo "$(report "$4.jpg"), quality $quality"
