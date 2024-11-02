TODO: smaller build size with compilation to executable?

# Ribston

This project is inspired by the awesome concept of Open Policy Agent (OPA)

Like said: the concept is awesome, but the execution is flawed.

Why learn a new programming/policy language that is incredible confusing
when there are plenty of scripting languages that are easy to learn and well known by millions?

Just create your policies in Typescript or JavaScript and execute them with Ribston.
Deno is the perfect tool for this job, as it fully sandboxes the policy execution.

Deno can seamlessly execute TS by compiling it to JS and running it without any further notice.

The problem of running TS policies in Deno is that the execution time is approximately 10 times longer than directly executing JS.

JS: 30ms
TS: 300ms

Workers have approximately half the CPU usage of processes

# Testing

run ribston in docker
`bash docker.sh`

`curl -X 'POST' http://localhost:8888/ -v -H 'content-type: application/json' -d @your-policy.json`
