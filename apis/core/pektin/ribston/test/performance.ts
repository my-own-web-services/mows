const policy = await Deno.readTextFile(
    `/home/paul/Documents/pektin/pektin-js-client/dist/policies/acme.ribston.js`
);
const input = `{"test":"test"}`;

const times = [];
const retries = 1;
const parallel = 1;
for (let ii = 1; ii <= parallel; ii++) {
    let t1 = 0;
    let res;
    let t2 = 0;
    let j: string[] = [];
    for (let iii = 0; iii < retries; iii++) {
        const reqs = [];
        for (let i = 0; i < ii; i++) {
            reqs.push(
                fetch(`http://[::]:8888/eval`, {
                    method: "post",
                    body: JSON.stringify({ policy, input }),
                    headers: { "content-type": "application/json" }
                })
            );
        }
        t1 += performance.now();
        res = await Promise.all(reqs);
        t2 += performance.now();
        j = await Promise.all(res.map(r => r.text()));

        await new Promise(resolve => setTimeout(resolve, 100));
    }
    t1 = t1 / retries;
    t2 = t2 / retries;

    times.push({
        requests: ii,
        totalTime: parseFloat((t2 - t1).toPrecision(3)),
        timePerRequest: parseFloat(((t2 - t1) / ii).toPrecision(3)),
        answer: j.every(e => e === `{"error":true,"message":"API method 'undefined' not allowed"}`)
    });
    await new Promise(resolve => setTimeout(resolve, 100));
}

console.log(`retries: ${retries}`);
console.log(`parallel: ${parallel}`);
console.log(`min: ${500}`);
console.log(`workers: ${2}`);

console.table(times);
console.log(JSON.stringify(times));
console.log(
    "Sum of all times per request: ",
    times.map(t => t.timePerRequest).reduce((pv, cv) => pv + cv, 0)
);
