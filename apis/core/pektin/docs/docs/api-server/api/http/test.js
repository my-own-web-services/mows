// in a ES module with top level await
const pc3 = {
    username: "admin-SY6B09EHzlheEg",
    managerPassword:
        "m.rx8u9sURdFcFRm0shHhxu1fHl2HqnHzmWacHB3Kb34I8TOTAd_I2aRx4V3ZonbFrQvt6gtO-cuLpEm6JXH_BaTLXkP3kZ-8qMfvgBuWueRlPsEFBNSn8U5l5IUoCr1l_xbkGTA",
    confidantPassword:
        "c.cJUAlvMk4pG4dIf67pCHOkZ9KS_yOTvpWRHBe1xpgqjtVWcrST-Jp1rKTQwS8EEjryYxN5NSVQNa2EMX-_ODPmbUD35bBx20ho5-LO-saoRcPj3MCxgfvJiCvbLgV3sklIK19w",
    vaultEndpoint: "http://vault.pektin.club.localhost"
};

// send a http POST request to vault to get the temporary access token that vault wants for anything else
const vaultTokenRes = await fetch(
    `${pc3.vaultEndpoint}/v1/auth/userpass/login/pektin-client-confidant-${pc3.username}`,
    {
        method: "POST",
        body: JSON.stringify({
            password: pc3.confidantPassword
        })
    }
);

// parse the json from the response body
const vaultTokenJson = await vaultTokenRes.json();

console.log(vaultTokenJson); // if this logs  { errors: [ "Vault is sealed" ] } you have to unlock vault first
const token = vaultTokenJson.auth.client_token;

// in a ES module with top level await

// send a http GET request to vault to get the pektin config
const pektinConfigRes = await fetch(`${pc3.vaultEndpoint}/v1/pektin-kv/data/pektin-config`, {
    headers: {
        "X-Vault-Token": token
    }
});

// parse the json from the response body
const pektinConfigJson = await pektinConfigRes.json();
const pektinConfig = pektinConfigJson.data.data;

// in a ES module with top level await

// construct the api endpoint for the request
const endpoint =
    "http://" +
    pektinConfig.services.api.subDomain +
    "." +
    pektinConfig.services.api.domain +
    ".localhost";

// request to get all records keys that are of type SOA
const res = await fetch(endpoint + "/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        confidant_password: pc3.confidantPassword,
        client_username: pc3.username,
        globs: [
            {
                name_glob: "*.",
                rr_type_glob: "SOA"
            }
        ]
    })
}).catch(e => {
    console.log(e);
});
console.log(JSON.stringify(await res.json()));
