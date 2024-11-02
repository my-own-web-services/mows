FROM denoland/deno:alpine
WORKDIR /ribston/
# create the temp policy file
RUN mkdir work watch; chown deno:deno work watch;
USER deno
# Cache deps
COPY src/deps.ts src/
RUN deno cache src/deps.ts
# add code
ADD ./ ./
# compile main.ts
RUN deno cache src/main.ts
CMD ["deno","run" ,"--allow-net", "--allow-run" ,"--allow-write=work/,watch/","--allow-read=src/evaluator/Worker.js,work/,watch/", "src/main.ts"]
