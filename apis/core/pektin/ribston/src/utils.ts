export const formatPolicy = (policy: string) => {
    // replace the input const
    policy = policy.replace(/.*const input([\S\s]*?)};/, "");
    // add an output statement that gets returned by eval
    policy += `\n output;`;
    return policy;
};
