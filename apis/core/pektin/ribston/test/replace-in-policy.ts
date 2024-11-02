const p = await Deno.readTextFile(
    `/home/paul/Documents/pektin/pektin-js-client/dist/policies/acme.ribston.js`
);

console.log(p.replaceAll(`\``, `"`));
