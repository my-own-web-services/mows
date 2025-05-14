{{- $config :=  yamlFile "../config.yml" -}}

{{- if eq $config.filez.runAsRoot false }}
{{- range $config.filez.readonlyMounts }}
find {{ .path }} -type d -exec chmod a+r {} \;
find {{ .path }} -type f -exec chmod a+r {} \;
{{- end }}
{{- end }}
