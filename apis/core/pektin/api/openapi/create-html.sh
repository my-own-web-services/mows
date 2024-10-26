docker run --rm --user $(id -u):$(id -g) -v "${PWD}:/local" openapitools/openapi-generator-cli generate \
    -i /local/pektin.yml \
    -g html \
    -o /local/dist

rm -rf dist/.openapi-generator-ignore dist/.openapi-generator

#cat ./dist/index.html | sed -z 's|<style.*</style>|<link rel="stylesheet" href="style.css">|g' | tee ./dist/index.html 