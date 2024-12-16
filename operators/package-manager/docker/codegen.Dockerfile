FROM openapitools/openapi-generator-cli

COPY docker/codegen.sh /codegen.sh


ENTRYPOINT ["bash","/codegen.sh"]