{{- $config :=  yamlFile "../config.yml" -}}

{{- range $config.filez.readonlyMounts }}
find {{ .path }} -type d -exec chmod a+r {} \;
find {{ .path }} -type f -exec chmod a+r {} \;
{{- end }}
