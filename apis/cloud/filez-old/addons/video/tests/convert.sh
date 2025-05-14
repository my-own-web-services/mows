FILE_NAME='/mnt/archive/Video/RawDLYT/Bushido X Shindy - Brot brechen.mp4'
Q=30

ffmpeg -hide_banner -i "$FILE_NAME" \
    -c:v libsvtav1 \
    -row-mt 1 \
    -keyint_min 150 \
    -g 150 \
    -tile-columns 4 \
    -frame-parallel 1 \
    -dash 1 \
    -f webm \
    -speed 3 \
    -threads 4 \
    -y \
    -an -vf scale=640x360 -b:v 0 -crf $Q -dash 1 640x360.webm \
    #-an -vf scale=1280x720 -b:v 0 -crf $Q -dash 1 1280x720_1500k.webm \
    #-an -vf scale=1920:1080 -b:v 0 -crf $Q -dash 1 1920x1080_3000k.webm \

ffmpeg -hide_banner -i "$FILE_NAME" -c:a libvorbis -b:a 192k -vn -f webm -dash 1 audio.webm -y

ffmpeg -hide_banner \
  -y \
  -f webm_dash_manifest -i 640x360.webm \
  -f webm_dash_manifest -i audio.webm \
  -c copy \
  -map 0 -map 1 \
  -f webm_dash_manifest \
  -adaptation_sets "id=0,streams=0 id=1,streams=1" \
  video_manifest.mpd