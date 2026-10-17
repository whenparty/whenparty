#!/bin/bash
# Encodes the journey videos and posters in html/media from the master video.
# Usage: scripts/encode-media.sh <master.mp4>
# Needs ffmpeg (with libx264 and libsvtav1) and cwebp.
set -euo pipefail

master=$1
out="$(cd "$(dirname "$0")/.." && pwd)/html/media"

# The mobile video is a portrait slice of the 1280x720 master: x 544-1120 covers
# every window a phone sees while the original framing pans from 82% to 59%.
# script.js maps the pan onto this crop, so keep the two in sync.
mobile_crop="crop=576:720:544:0"

# The master is untagged; tag it BT.709 so browsers render the colors the same
# way as the sRGB posters.
bt709="setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"

# A keyframe every 12 frames (0.5 s) keeps scroll seeking cheap. Limiting
# B-frames and references keeps the stream at level 3.1 for older phones.
encode_h264() {
  local filter=$1 target=$2
  ffmpeg -v error -y -i "$master" -an -vf "$filter,$bt709" \
    -c:v libx264 -preset veryslow -crf 26 -bf 2 -refs 4 \
    -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p \
    -movflags +faststart "$out/$target"
}

# AV1 is 25-35% smaller than the H.264 at a slightly higher SSIM, but script.js
# only picks it where the browser decodes it in hardware. Its decodingInfo()
# query lists each stream's level and bitrate, so update it when these change.
encode_av1() {
  local filter=$1 crf=$2 target=$3
  SVT_LOG=1 ffmpeg -v error -y -i "$master" -an -vf "$filter,$bt709" \
    -c:v libsvtav1 -preset 4 -crf "$crf" -g 12 -pix_fmt yuv420p \
    -movflags +faststart "$out/$target"
}

# Posters are frame 0, so the swap to the video is seamless.
encode_poster() {
  local filter=$1 target=$2 frame
  frame=$(mktemp -t poster).png
  ffmpeg -v error -y -i "$master" -vf "$filter,$bt709" -frames:v 1 "$frame"
  cwebp -quiet -q 75 -m 6 "$frame" -o "$out/$target"
  rm -f "$frame"
}

encode_h264 null journey-desktop.mp4
encode_h264 "$mobile_crop" journey-mobile.mp4
encode_av1 null 38 journey-desktop.av1.mp4
encode_av1 "$mobile_crop" 36 journey-mobile.av1.mp4
encode_poster null poster-desktop.webp
encode_poster "$mobile_crop" poster-mobile.webp
ls -l "$out"
