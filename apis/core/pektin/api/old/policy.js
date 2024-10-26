var RequestType;
(function (RequestType) {
    RequestType["Get"] = "get";
    RequestType["GetZone"] = "get-zone";
    RequestType["Delete"] = "delete";
    RequestType["Set"] = "set";
    RequestType["Search"] = "search";
    RequestType["Health"] = "health";
})(RequestType || (RequestType = {}));
const input = {};
const output = {};
/* Your code goes beneath this */
const err = msg => {
    output.error = true;
    output.message = msg;
};
if (input.api_method === "get" || input.api_method === "delete") {
    const body = input.api_method === "get" ? input.request_body.Get : input.request_body.Delete;
    if (!body.keys.every(key => key.startsWith("_acme-challenge") && key.endsWith(".:TXT"))) {
        err("Invalid key");
    }
} else if (input.api_method === "set") {
    if (
        !input.request_body.Set.records.every(
            record => record.name.startsWith("_acme-challenge") && record.name.endsWith(".:TXT")
        )
    ) {
        err("Invalid key");
    }
} else {
    err(`API method '${input.api_method}' not allowed`);
}
if (output.error === undefined) {
    output.error = false;
    output.message = "Success";
}
export {};
