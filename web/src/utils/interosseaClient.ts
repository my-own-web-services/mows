export class InterosseaClient {
    endpoint: string;
    token!: InterosseaToken;
    assertion_validity_seconds!: number;
    skip?: boolean;

    constructor(endpoint: string, skip?: boolean) {
        this.endpoint = endpoint;
        this.skip = skip;
    }

    init = async () => {
        this.assertion_validity_seconds = await this.get_assertion_validity_seconds();
        await this.renew();
    };

    get_assertion_validity_seconds = async () => {
        const res = await fetch(`/api/get_assertion_validity_seconds/`);
        return parseInt(await res.text());
    };

    renew = async () => {
        await this.get_session_cookie();
        setTimeout(
            this.renew,
            (this.assertion_validity_seconds - this.assertion_validity_seconds / 10) * 1000
        );
    };

    get_user_assertion = async (service: string) => {
        const res = await fetch(`${this.endpoint}/api/get_user_assertion/?s=${service}`, {
            method: "POST",
            credentials: "include"
        });
        return await res.text();
    };

    get_session_cookie = async () => {
        await fetch(`/api/get_session_cookie/`, {
            method: "POST",
            headers: {
                InterosseaUserAssertion: await this.get_user_assertion("filez")
            }
        });
    };
}

export interface InterosseaToken {
    token: string;
    createdSecs: number;
}
