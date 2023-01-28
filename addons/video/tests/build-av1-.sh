docker build . -t svt-av1-builder
docker create -ti --name svt-av1-builder svt-av1-builder bash
docker cp svt-av1-builder:/app/SVT-AV1/Bin/Release/SvtAv1EncApp ./
docker rm -f svt-av1-builder

# https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/Build-Guide.md