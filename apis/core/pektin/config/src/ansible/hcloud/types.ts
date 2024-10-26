export interface FloatingIpResponse {
    changed: boolean;
    skipped?: boolean;
    skip_reason?: string;
    hcloud_floating_ip?: {
        id: string;
        name: string;
        description: string;
        ip: string;
        type: string;
        home_location: string;
        labels: { group: string };
        server: string;
        delete_protection: boolean;
    };
    failed?: boolean;
}

export interface ServerResponse {
    changed: boolean;
    skipped?: boolean;
    skip_reason?: string;
    hcloud_server?: {
        id: string;
        name: string;
        ipv4_address: string;
        ipv6: string;
        image: string;
        server_type: string;
        datacenter: string;
        location: string;
        rescue_enabled: boolean;
        backup_window: string;
        labels: { group: string; project: string };
        delete_protection: boolean;
        rebuild_protection: boolean;
        status: string;
    };
    failed?: boolean;
}
