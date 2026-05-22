import CopyValueButton from "@mows/react-components/components/input/copyValueButton/CopyValueButton";
import { MowsContext } from "@mows/react-components/lib/mowsContext/MowsContext";
import { PureComponent, type CSSProperties } from "react";

interface NotesProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface Note {
    id?: string;
    content: string;
    type: `default` | `custom`;
    description?: string;
}

interface NotesState {
    readonly newNote: string;
    readonly notes: Note[];
}

const defaultNotes: Note[] = [
    {
        content: `sudo journalctl -u k3s -b`,
        type: `default`,
        description: `View k3s logs, run it on the node not in the manager`
    },
    {
        content: `k -n mows-dev-k8s-dashboard create token admin-user --duration 488h`,
        type: `default`,
        description: `Create a token for the kubernetes-dashboard`
    },
    {
        content: `k delete ciliumclusterwidenetworkpolicy.cilium.io -A --all && k delete ciliumnetworkpolicy.cilium.io -A --all && k apply -f /install/core-apis/network/policies/`,
        type: `default`,
        description: `Re-apply network policies from install directory, omit the last part to just delete all policies`
    },
    {
        content: `k get ciliumendpoints -A`,
        type: `default`,
        description: `List cilium endpoints`
    },
    {
        content: `k logs POD -n NAMESPACE -c CONTAINER_IN_POD `,
        type: `default`,
        description: `get logs from a specific container in a pod, useful for failing init containers`
    },
    {
        content: `kubectl cnpg pgadmin4 filez-postgres -n mows-core-storage-filez &&
kubectl get secret filez-db-user -n mows-core-storage-filez -o 'jsonpath={.data.password}' | base64 -d; echo "" &&
kubectl port-forward deployment/filez-postgres-pgadmin4 8080:80 -n mows-core-storage-filez --address 0.0.0.0

filez-postgres-rw
filez`,
        type: `default`,
        description: `Setup filez postgres pgadmin4 and forward it to http://localhost:8080`
    },
    {
        content: `k -n mows-core-argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d ; echo`,
        type: `default`,
        description: `Get the argocd admin password`
    },
    {
        content: `kubectl port-forward -n mows-core-secrets-vault service/vault-ui --address 0.0.0.0 8080:http`,
        type: `default`,
        description: `Forward vault ui to http://localhost:8080/ui/`
    },
    {
        content: `kubectl port-forward -n mows-core-network-cilium service/hubble-ui --address 0.0.0.0 8080:http`,
        type: `default`,
        description: `Forward cilium/hubble ui to http://localhost:8080/ui/`
    },
    {
        content: `kubectl apply -f /operators/vault-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-secrets-vrc /operators/vault-resource-controller/charts/vrc/ -n mows-core-secrets-vrc --create-namespace ; helm upgrade mows-core-dns-pektin /apis/core/pektin/charts/pektin --create-namespace --namespace mows-core-dns-pektin --install ; kubectl apply -f /operators/pektin-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-dns-pektin-controller /operators/pektin-resource-controller/charts/pektin-resource-controller/ -n mows-core-dns-pektin --create-namespace `,
        description: `Install vault-resource-controller, pektin and pektin-resource-controller`,
        type: `default`
    },
    {
        content: `kubectl port-forward -n mows-core-tracing service/mows-core-tracing-jaeger-query --address 0.0.0.0 8080:http-query`,
        description: `Forward jaeger query to http://localhost:8080/`,
        type: `default`
    },
    {
        content: `helm repo add jaegertracing https://jaegertracing.github.io/helm-charts ; helm upgrade mows-core-tracing-jaeger jaegertracing/jaeger -n mows-core-tracing --set allInOne.enabled=true --create-namespace --install --set storage.type=memory --set agent.enabled=false --set collector.enabled=false --set query.enabled=false --set provisionDataStore.cassandra=false`,
        description: `Install jaeger all-in-one`,
        type: `default`
    },
    {
        content: `Zitadel login data: zitadel-admin / Password1!`,
        description: `Zitadel login data`,
        type: `default`
    }
];

export default class Notes extends PureComponent<NotesProps, NotesState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: NotesProps) {
        super(props);
        this.state = {
            newNote: ``,
            notes: []
        };
    }

    getNotes = () => {
        const stored = JSON.parse(localStorage.getItem(`notes`) ?? `[]`) as Note[];
        return [...defaultNotes, ...stored];
    };

    render = () => {
        const notes = this.getNotes();
        return (
            <div
                style={this.props.style}
                className={`Notes w-full ${this.props.className ?? ``}`}
            >
                <div className={`flex h-full flex-col gap-2 overflow-y-auto`}>
                    {notes.map((note, index) => (
                        <div key={index} className={`flex justify-between gap-2`}>
                            <CopyValueButton
                                value={note.content}
                                title={this.context!.t.manager.common.copyToClipboard}
                                className={`h-8`}
                            />
                            <pre
                                className={`w-full max-w-full rounded-lg border border-border bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap text-foreground`}
                                title={note.description}
                            >
                                {note.content}
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
}
