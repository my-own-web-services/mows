#!/bin/bash
set -e

docker build . -f ffmpeg.Dockerfile -t ffmpeg-builder
docker create -ti --name ffmpeg-builder ffmpeg-builder bash
docker cp ffmpeg-builder:/app/ffmpeg/ffmpeg ./
docker cp ffmpeg-builder:/app/ffmpeg/ffprobe ./
docker rm -f ffmpeg-builder