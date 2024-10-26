/* eslint-disable quotes */

export type Logging = string;
/**
 * A valid UTF8 domain name NOT ending with a dot
 */
export type DomainName = string;
/**
 * A valid UTF8 domain name NOT ending with a dot
 */
export type SubDomain = string;
/**
 * A valid email address
 */
export type Email = string;
/**
 * A valid ip(ipv6) address
 */
export type Ip = string;
/**
 * A valid legacyIp(ipv4) address
 */
export type LegacyIp = string;
export type AnsibleConfig = Hetzner;
export type AnsibleConfigType = "hetzner";
export type HetznerServerType =
  | "cx11"
  | "cpx11"
  | "cx21"
  | "cpx21"
  | "cx31"
  | "cpx31"
  | "cx41"
  | "cpx41"
  | "cx51"
  | "cpx51";

/**
 * The configuration for the Pektin DNS server
 */
export interface PektinConfig {
  services: {
    server: {
      enabled: boolean;
      logging: Logging;
      build: BuildFromSource;
    };
    ui: {
      enabled: boolean;
      domain: DomainName;
      subDomain: SubDomain;
      build: BuildFromSource;
    };
    api: {
      perimeterAuth: boolean;
      domain: DomainName;
      subDomain: SubDomain;
      logging: Logging;
      build: BuildFromSource;
    };
    vault: {
      perimeterAuth: boolean;
      domain: DomainName;
      subDomain: SubDomain;
      build: BuildFromSource;
    };
    verkehr: {
      enabled: boolean;
      build: BuildFromSource;
      routing: "local" | "domain" | "minikube";
      tempZone: {
        enabled: boolean;
        /**
         * Get a temporary subdomain for an easy and secure access while your domain changes still propagate. This subdomain will exist for 7 days, will then be deleted and not be recoverable afterwards. For pektin.zone. this implies your acceptance of our privacy policy.
         */
        provider: string;
        routing: "local" | "public";
      };
      tls: boolean;
      /**
       * Proxy to external APIs that aren't configured to use CORS.
       */
      external: {
        enabled: boolean;
        domain: DomainName;
        subDomain: SubDomain;
        services: {
          enabled: boolean;
          name: string;
          domain: string;
          accessControlAllowMethods: string[];
          accessControlAllowHeaders: string[];
        }[];
      };
    };
    zertificat: {
      enabled: boolean;
      build: BuildFromSource;
      acmeEndpoint: string;
      acmeEmail: Email;
      /**
       * This OVERRIDES the acmeEndpoint internally as well as build.dockerfile
       */
      usePebble?: boolean;
    };
    tnt: {
      enabled: boolean;
      domain: DomainName;
      subDomain: SubDomain;
      build: BuildFromSource;
    };
    ribston: {
      enabled: boolean;
      build: BuildFromSource;
    };
    opa: {
      enabled: boolean;
      build: BuildFromSource;
    };
    jaeger: {
      enabled: boolean;
      build: BuildFromSource;
    };
    prometheus: {
      enabled: boolean;
      build: BuildFromSource;
    };
    grafana: {
      enabled: boolean;
      domain: DomainName;
      subDomain: SubDomain;
      build: BuildFromSource;
    };
    alert: {
      enabled: boolean;
      build: BuildFromSource;
    };
  };
  usePolicies: "ribston" | "opa" | "both" | false;
  nodes: [
    {
      main?: boolean;
      ips?: [Ip, ...Ip[]];
      legacyIps?: [LegacyIp, ...LegacyIp[]];
      name: string;
      ansible?: AnsibleConfig;
      setup?: {
        system: string;
        root: {
          disableSystemdResolved: boolean;
          installDocker: boolean;
        };
        cloneRepo: boolean;
        setup: boolean;
        start: boolean;
      };
    },
    ...{
      main?: boolean;
      ips?: [Ip, ...Ip[]];
      legacyIps?: [LegacyIp, ...LegacyIp[]];
      name: string;
      ansible?: AnsibleConfig;
      setup?: {
        system: string;
        root: {
          disableSystemdResolved: boolean;
          installDocker: boolean;
        };
        cloneRepo: boolean;
        setup: boolean;
        start: boolean;
      };
    }[]
  ];
  nameservers: [
    {
      subDomain?: SubDomain;
      domain: DomainName;
      node: string;
      main?: boolean;
    },
    ...{
      subDomain?: SubDomain;
      domain: DomainName;
      node: string;
      main?: boolean;
    }[]
  ];
  ansible?: {
    sshPubKeyName: string;
  };
}
export interface BuildFromSource {
  enabled: boolean;
  path: string;
  dockerfile: string;
}
export interface Hetzner {
  configType: AnsibleConfigType;
  floatingIp?: boolean;
  floatingLegacyIp?: boolean;
  location?: "nbg1" | "fsn1";
  serverType?: HetznerServerType;
}
