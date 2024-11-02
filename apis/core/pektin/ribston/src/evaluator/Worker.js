self.onmessage = e => {
    const input = e.data.input;
    let evalOutput;
    try {
        evalOutput = eval(e.data.policy);
    } catch (error) {
        return self.postMessage({ status: "ERROR", message: error.message });
    }

    return self.postMessage(evalOutput);
};
