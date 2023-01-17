export class InterosseaClient {
    endpoint: string;
    token!: InterosseaToken;
    assertion_validity_seconds!: number;
    skip?: boolean;

    constructor(endpoint: string,skip?:boolean) {
        this.endpoint = endpoint;
        this.skip = skip;
    }

    init = async () => {
        this.assertion_validity_seconds = await this.get_assertion_validity_seconds();
    };

    get_assertion_validity_seconds = async () => {
        const res = await fetch(`/api/get_assertion_validity_seconds/`);
        return parseInt(await res.text());
    };

    get_user_assertion = async (service: string): Promise<InterosseaToken> => {
        const res = await fetch(`${this.endpoint}/api/get_user_assertion/?s=${service}`, {
            method: "POST",
            credentials: "include"
        });
        return {
            token: await res.text(),
            createdSecs: Date.now() / 1000
        };
    };

    get_token = async () => {
        if(this.skip) return "";
        const currentTimeSecs = Date.now() / 1000;
        if (
            !this.token ||
            this.token.createdSecs + this.assertion_validity_seconds > currentTimeSecs - 10
        ) {
            this.token = await this.get_user_assertion("filez");
        }
        return this.token.token;
    };

    f = async (url: string, fetchParameters?: RequestInit) => {
        return fetch(url, {
            ...fetchParameters,
            headers: {
                InterosseaUserAssertion: await this.get_token()
            }
        });
    };
}

export interface InterosseaToken {
    token: string;
    createdSecs: number;
}
