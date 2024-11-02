import { Application, Router, Ajv } from "./deps.ts";
import { Evaluator } from "./evaluator/Evaluator.ts";
import { formatPolicy } from "./utils.ts";
const ajv = new Ajv();

const requestSchema = {
    properties: {
        policy: { type: `string` },
        input: { properties: {}, additionalProperties: true }
    }
};
const validateRequestSchema = ajv.compile(requestSchema);

const router = new Router();

const evaluators = 500;
const workers = 2;
const switchLimit = 2;
const maxCCR = 500;

const evalPool: Evaluator[] = [];
for (let i = 0; i < evaluators; i++) {
    const newEval = new Evaluator({ id: i.toString(), type: i < workers ? "worker" : "process" });
    await newEval.createFirst();
    evalPool.push(newEval);
}

export const getEvaluator = async (evalPool: Evaluator[]): Promise<Evaluator | false> => {
    if (ccr > maxCCR) return false;
    for (let i = ccr > switchLimit ? workers : 0; i < evalPool.length; i++) {
        const evaluator = evalPool[i];
        if (evaluator.ready) {
            evaluator.ready = false;
            console.log(`selected evaluator ${i} ${evaluator.type}`);

            return evaluator;
        }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    return getEvaluator(evalPool);
};

export const randomString = (length = 100) => {
    function dec2hex(dec: number) {
        return dec.toString(16).padStart(2, "0");
    }

    const arr = new Uint8Array((length || 40) / 2);
    crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join("");
};

export const removeFiles = async (policyPath: string, inputPath: string) => {
    return await Promise.all([Deno.remove(policyPath), Deno.remove(inputPath)]);
};

router.post(`/health`, context => {
    context.response.headers.set(`content-type`, `application/json`);
    context.response.body = { status: "SUCCESS" };
    context.response.status = 200;
    return;
});


let ccr = 0;
router.post(`/eval`, async context => {
    ccr++;
    context.response.headers.set(`content-type`, `application/json`);

    if (context.request.headers.get(`content-type`) !== `application/json`) {
        context.response.status = 400;
        context.response.body = {
            status: "INVALID_CONTENT_TYPE",
            message: `Invalid content type header: 'content-type: application/json' is required`
        };
        ccr--;
        return;
    }
    if (!context.request.hasBody) {
        context.response.status = 400;
        context.response.body = {
            message: `Body required`,
            status: "BODY_REQUIRED"
        };
        ccr--;
        return;
    }
    let body;
    try {
        body = await context.request.body({ type: `json` }).value;
    } catch (e) {
        context.response.status = 400;
        context.response.body = {
            status: "BODY_NOT_PARSEABLE",
            message: `Error while trying to parse body: ` + e
        };
        ccr--;
        return;
    }

    if (!validateRequestSchema(body)) {
        context.response.status = 400;
        context.response.body = {
            status: "INVALID_BODY_SCHEMA",
            message:
                `Invalid request body schema: ` +
                (validateRequestSchema.errors ? validateRequestSchema.errors[0].message : ``),
            data: validateRequestSchema.errors
        };
        ccr--;
        return;
    }

    const { input, policy } = body as {
        input: string;
        policy: string;
    };

    console.log(input, policy);

    const evaluator = await getEvaluator(evalPool);

    try {
        if (!evaluator) {
            context.response.body = {
                message: "No evaluator available",
                status: "NO_EVALUATOR_AVAILABLE"
            };
            context.response.status = 200;
            ccr--;
            return;
        }

        const answer = await evaluator.callEval(input, formatPolicy(policy));

        context.response.body = answer
            ? {
                  message: "Success",
                  status: "SUCCESS",
                  data: JSON.parse(answer)
              }
            : {
                  message: "Invalid answer from evaluator",
                  status: "INVALID_EVALUATOR_ANSWER"
              };
        context.response.status = 200;
    } catch (error) {
        console.error(error);

        context.response.body = {
            message: error.message,
            status: "FAILED_TO_EVALUATE"
        };
        context.response.status = 400;
    }
    ccr--;
    return;
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server started`);

await app.listen({ port: 80 });
