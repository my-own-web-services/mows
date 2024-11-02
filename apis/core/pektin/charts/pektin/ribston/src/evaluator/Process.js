const id = Deno.args[0];
const watcher = Deno.watchFs(`./watch/${id}/`);

for await (const event of watcher) {
    const rawFile = await Deno.readTextFile(`./work/${id}/policy.json`);
    let input, policy;
    try {
        const r = JSON.parse(rawFile);
        input = JSON.parse(r.input);
        policy = r.policy;
    } catch (error) {
        console.log(
            JSON.stringify({ status: "FAILED_TO_PARSE_INPUT", message: "Failed to parse Input" })
        );
        break;
    }

    //@ts-ignore x
    delete globalThis.Deno;
    let evalOutput;
    try {
        evalOutput = eval(policy);
    } catch (error) {
        console.log(JSON.stringify({ status: "ERROR", message: error.message }));
        break;
    }

    console.log(JSON.stringify(evalOutput));
    break;
}
