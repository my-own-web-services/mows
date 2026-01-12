# Values and Templating

mpm uses Go templates (via gtmpl) with an extensive function library. This guide covers the template syntax and available functions.

## Template Syntax Basics

### Accessing Values

Values from `values.yaml` are available at the root level:

```yaml
# values.yaml
hostname: example.com
port: 8080
database:
  host: localhost
  port: 5432
```

```yaml
# template
server: {{ .hostname }}:{{ .port }}
db_host: {{ .database.host }}
db_port: {{ .database.port }}
```

### Variable Definitions

You can use the `$variable` syntax for frequently accessed values:

```yaml
{{- $host := .hostname }}
{{- $db := .database }}
Server: {{ $host }}
Database: {{ $db.host }}:{{ $db.port }}
```

**Note:** mpm automatically creates `$varname` shortcuts for all top-level values.

### Chart Variables

Manifest metadata is available under `$chart`:

```yaml
Project: {{ $chart.projectName }}
Version: {{ $chart.version }}
Description: {{ $chart.description }}
```

## Control Structures

### Conditionals

```yaml
{{- if eq .environment "production" }}
replicas: 3
{{- else if eq .environment "staging" }}
replicas: 2
{{- else }}
replicas: 1
{{- end }}
```

### Boolean Checks

```yaml
{{- if .features.ssl.enabled }}
  - "--https"
{{- end }}

{{- if not .debug }}
  - "--quiet"
{{- end }}
```

### Loops

```yaml
# Loop over a list
{{- range .ports }}
  - {{ . }}
{{- end }}

# Loop with index
{{- range $i, $port := .ports }}
  port_{{ $i }}: {{ $port }}
{{- end }}

# Loop over a map
{{- range $key, $value := .environment }}
  {{ $key }}: {{ $value }}
{{- end }}
```

### Default Values

```yaml
# Use default if value is empty
port: {{ .port | default 8080 }}
host: {{ .host | default "localhost" }}
```

## Whitespace Control

Use `-` to trim whitespace:

```yaml
{{- if .condition }}     # Trims whitespace before
content
{{- end }}               # Trims whitespace before

{{ if .condition -}}     # Trims whitespace after
content
{{ end -}}               # Trims whitespace after
```

## Available Functions

### String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `upper` | Uppercase | `{{ upper "hello" }}` → `HELLO` |
| `lower` | Lowercase | `{{ lower "HELLO" }}` → `hello` |
| `title` | Title case | `{{ title "hello world" }}` → `Hello World` |
| `trim` | Trim whitespace | `{{ trim "  hi  " }}` → `hi` |
| `trimPrefix` | Remove prefix | `{{ trimPrefix "hello" "hel" }}` → `lo` |
| `trimSuffix` | Remove suffix | `{{ trimSuffix "hello" "lo" }}` → `hel` |
| `replace` | Replace string | `{{ replace "hello" "l" "L" }}` → `heLLo` |
| `contains` | Check substring | `{{ if contains "hello" "ell" }}yes{{ end }}` |
| `hasPrefix` | Check prefix | `{{ if hasPrefix "hello" "hel" }}yes{{ end }}` |
| `hasSuffix` | Check suffix | `{{ if hasSuffix "hello" "lo" }}yes{{ end }}` |
| `quote` | Add quotes | `{{ quote "hello" }}` → `"hello"` |
| `squote` | Single quotes | `{{ squote "hello" }}` → `'hello'` |
| `indent` | Indent lines | `{{ indent 4 "line1\nline2" }}` |
| `nindent` | Newline + indent | `{{ nindent 4 "content" }}` |

### Random Generation

| Function | Description | Example |
|----------|-------------|---------|
| `randAlphaNum` | Random alphanumeric | `{{ randAlphaNum 32 }}` |
| `randAlpha` | Random letters | `{{ randAlpha 16 }}` |
| `randNumeric` | Random numbers | `{{ randNumeric 8 }}` |
| `randAscii` | Random ASCII | `{{ randAscii 20 }}` |
| `uuidv4` | Random UUID | `{{ uuidv4 }}` → `550e8400-e29b-41d4-a716-446655440000` |

### Type Conversion

| Function | Description | Example |
|----------|-------------|---------|
| `toString` | Convert to string | `{{ toString 123 }}` |
| `toInt` | Convert to integer | `{{ toInt "123" }}` |
| `toFloat64` | Convert to float | `{{ toFloat64 "1.5" }}` |
| `toBool` | Convert to boolean | `{{ toBool "true" }}` |

### List Functions

| Function | Description | Example |
|----------|-------------|---------|
| `list` | Create a list | `{{ list "a" "b" "c" }}` |
| `first` | First element | `{{ first .items }}` |
| `last` | Last element | `{{ last .items }}` |
| `rest` | All but first | `{{ rest .items }}` |
| `initial` | All but last | `{{ initial .items }}` |
| `append` | Add to end | `{{ append .items "new" }}` |
| `prepend` | Add to start | `{{ prepend .items "new" }}` |
| `concat` | Join lists | `{{ concat .list1 .list2 }}` |
| `reverse` | Reverse order | `{{ reverse .items }}` |
| `uniq` | Remove duplicates | `{{ uniq .items }}` |
| `has` | Check membership | `{{ if has .items "value" }}` |
| `without` | Remove items | `{{ without .items "a" "b" }}` |
| `join` | Join with separator | `{{ join .items "," }}` |
| `sortAlpha` | Sort strings | `{{ sortAlpha .items }}` |

### Dictionary Functions

| Function | Description | Example |
|----------|-------------|---------|
| `dict` | Create dictionary | `{{ dict "key" "value" }}` |
| `get` | Get value | `{{ get .map "key" }}` |
| `set` | Set value | `{{ set .map "key" "value" }}` |
| `unset` | Remove key | `{{ unset .map "key" }}` |
| `hasKey` | Check key exists | `{{ if hasKey .map "key" }}` |
| `keys` | Get all keys | `{{ keys .map }}` |
| `values` | Get all values | `{{ values .map }}` |
| `merge` | Merge dictionaries | `{{ merge .map1 .map2 }}` |

### Math Functions

| Function | Description | Example |
|----------|-------------|---------|
| `add` | Addition | `{{ add 1 2 }}` → `3` |
| `sub` | Subtraction | `{{ sub 5 2 }}` → `3` |
| `mul` | Multiplication | `{{ mul 2 3 }}` → `6` |
| `div` | Division | `{{ div 10 2 }}` → `5` |
| `mod` | Modulo | `{{ mod 10 3 }}` → `1` |
| `max` | Maximum | `{{ max 1 5 3 }}` → `5` |
| `min` | Minimum | `{{ min 1 5 3 }}` → `1` |
| `floor` | Round down | `{{ floor 1.9 }}` → `1` |
| `ceil` | Round up | `{{ ceil 1.1 }}` → `2` |
| `round` | Round | `{{ round 1.5 }}` → `2` |

### Comparison Functions

| Function | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `{{ if eq .a .b }}` |
| `ne` | Not equal | `{{ if ne .a .b }}` |
| `lt` | Less than | `{{ if lt .a .b }}` |
| `le` | Less or equal | `{{ if le .a .b }}` |
| `gt` | Greater than | `{{ if gt .a .b }}` |
| `ge` | Greater or equal | `{{ if ge .a .b }}` |
| `and` | Logical AND | `{{ if and .a .b }}` |
| `or` | Logical OR | `{{ if or .a .b }}` |
| `not` | Logical NOT | `{{ if not .a }}` |

### Date/Time Functions

| Function | Description | Example |
|----------|-------------|---------|
| `now` | Current time | `{{ now }}` |
| `date` | Format date | `{{ now | date "2006-01-02" }}` |
| `dateModify` | Modify date | `{{ now | dateModify "+1h" }}` |
| `toDate` | Parse date | `{{ toDate "2006-01-02" "2024-01-15" }}` |

### Encoding Functions

| Function | Description | Example |
|----------|-------------|---------|
| `b64enc` | Base64 encode | `{{ b64enc "hello" }}` |
| `b64dec` | Base64 decode | `{{ b64dec "aGVsbG8=" }}` |
| `urlEncode` | URL encode | `{{ urlEncode "hello world" }}` |
| `urlDecode` | URL decode | `{{ urlDecode "hello%20world" }}` |

## Common Patterns

### Conditional Service Configuration

```yaml
services:
  app:
    {{- if eq .services.app.build.enabled true }}
    build:
      context: "{{ .services.app.build.context }}"
      dockerfile: "{{ .services.app.build.dockerfile }}"
    {{- else }}
    image: "{{ .services.app.image }}"
    {{- end }}
```

### Environment Variables from Map

```yaml
environment:
  {{- range $key, $value := .app.environment }}
  - {{ $key }}={{ $value }}
  {{- end }}
```

### Port Mapping

```yaml
ports:
  {{- range .services.web.ports }}
  - "{{ . }}"
  {{- end }}
```

### Volume Mounts

```yaml
volumes:
  - ./data:/app/data
  {{- range .extraVolumes }}
  - {{ . }}
  {{- end }}
```

### Traefik Labels

```yaml
labels:
  traefik:
    enable: "true"
    http:
      routers:
        {{ $chart.projectName }}:
          rule: "Host(`{{ .hostname }}`)"
          entrypoints: websecure
          tls:
            certresolver: letsencrypt
      services:
        {{ $chart.projectName }}:
          loadbalancer:
            server:
              port: "{{ .port }}"
```

## Template Debugging

### Print Variable Values

```yaml
# Debug: show what .database contains
# {{ printf "%#v" .database }}
```

### Check Variable Type

```yaml
# Type checking
{{- if kindIs "map" .config }}
  # It's a map/object
{{- else if kindIs "slice" .config }}
  # It's a list/array
{{- end }}
```

## Error Handling

When a template error occurs, mpm shows:
- The file and line number
- Context around the error
- Available variables at that point

```
Error in templates/docker-compose.yaml:15
  13 |   app:
  14 |     image: {{ .image }}
> 15 |     ports: {{ .undefined.value }}
  16 |     restart: unless-stopped

Error: map has no entry for key "undefined"

Available variables: .chart, .hostname, .image, .port
```
