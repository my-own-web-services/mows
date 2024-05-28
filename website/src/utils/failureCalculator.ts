const binomialCoefficient = (n: number, k: number) => {
    if (k > n) return 0;
    let coeff = 1;
    for (let i = 0; i < k; i++) {
        coeff *= (n - i) / (i + 1);
    }
    return coeff;
};

export interface Component {
    name: string;
    failureProbabilityPerYear: number;
}

export const calcNodeFailureProbabilityPerDay = (components: Component[]) => {
    let nodeFailureProbabilityPerDay = 1;

    components.forEach(component => {
        nodeFailureProbabilityPerDay *= 1 - component.failureProbabilityPerYear / 365;
    });
    return 1 - nodeFailureProbabilityPerDay;
};

export const calcControlPlaneFailureProbabilityPerDay = (
    nodeCount: number,
    nodeFailureProbabilityPerDay: number
) => {
    const nodesToFail = Math.floor(nodeCount / 2) + (nodeCount % 2);

    let controlPlaneFailureProbability = 0;
    for (let i = nodesToFail; i <= nodeCount; i++) {
        controlPlaneFailureProbability +=
            binomialCoefficient(nodeCount, i) *
            Math.pow(nodeFailureProbabilityPerDay, i) *
            Math.pow(1 - nodeFailureProbabilityPerDay, nodeCount - i);
    }

    return controlPlaneFailureProbability;
};

// calculate the failure probability of the control plane when

export const calcProb = () => {
    const nodeFailureProbabilityPerDay = calcNodeFailureProbabilityPerDay([
        {
            name: "CPU",
            failureProbabilityPerYear: 0.1
        },
        {
            name: "Cooling",
            failureProbabilityPerYear: 0.1
        },
        {
            name: "Memory",
            failureProbabilityPerYear: 0.1
        },
        {
            name: "Motherboard",
            failureProbabilityPerYear: 0.1
        },
        {
            name: "Disk",
            failureProbabilityPerYear: 0.5
        },
        {
            name: "Power Supply",
            failureProbabilityPerYear: 0.25
        }
    ]);
    console.log(nodeFailureProbabilityPerDay);

    Array.from({ length: 3 }, (_, i): any => {
        console.log(calcControlPlaneFailureProbabilityPerDay(i + 1, 0.0031470465089386));
    });
};
