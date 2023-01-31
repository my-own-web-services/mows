export class InterosseaClient {
    endpoint: string;
    token!: InterosseaToken;
    assertionValiditySeconds!: number;
    skip?: boolean;
    applicationEndpoint: string;
    serviceName: string;

    constructor(
        endpoint: string,
        applicationEndpoint: string,
        serviceName: string,
        skip?: boolean
    ) {
        this.endpoint = endpoint;
        this.skip = skip;
        this.applicationEndpoint = applicationEndpoint;
        this.serviceName = serviceName;
    }

    init = async () => {
        this.assertionValiditySeconds = await this.get_assertion_validity_seconds();
        await this.renew();
    };

    get_assertion_validity_seconds = async () => {
        const res = await fetch(`${this.applicationEndpoint}/api/get_assertion_validity_seconds/`, {
            credentials: "include"
        });
        return parseInt(await res.text());
    };

    renew = async () => {
        await this.get_session_cookie();
        setTimeout(
            this.renew,
            (this.assertionValiditySeconds - this.assertionValiditySeconds / 10) * 1000
        );
    };

    get_user_assertion = async () => {
        const res = await fetch(`${this.endpoint}/api/get_user_assertion/?s=${this.serviceName}`, {
            method: "POST",
            credentials: "include"
        });
        return await res.text();
    };

    get_session_cookie = async () => {
        await fetch(`${this.applicationEndpoint}/api/get_session_cookie/`, {
            method: "POST",
            credentials: "include",
            headers: {
                InterosseaUserAssertion: await this.get_user_assertion()
            }
        });
    };
}

export interface InterosseaToken {
    token: string;
    createdSecs: number;
}
