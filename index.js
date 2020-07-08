
const gcp = require("@pulumi/gcp");
const k8s =  require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");
const tls = require("@pulumi/tls");
const keycloak = require("@pulumi/keycloak");

const config = new pulumi.Config();

var socNamespace = config.require("k8s-namespace");

const ipAddress = new gcp.compute.Address("address", {
    name: config.require("soc-id") + "-evs",
    region: config.require("region")
});

const dnsZone = gcp.dns.getManagedZone({
    name: config.require("dns-zone")
});

const portalDns = new gcp.dns.RecordSet("portal-dns", {
    name: config.require("portal-host") + ".",
    type: "A",
    ttl: 300,
    managedZone: dnsZone.then(zone => zone.name),
    rrdatas: [ipAddress.address],
});
              
const accountsDns = new gcp.dns.RecordSet("account-dns", {
    name: config.require("accounts-host") + ".",
    type: "A",
    ttl: 300,
    managedZone: dnsZone.then(zone => zone.name),
    rrdatas: [ipAddress.address],
});

const engineVersion = gcp.container.getEngineVersions({
    location: config.require("zone"),
}).then(v => v.latestMasterVersion);

const cluster = new gcp.container.Cluster("cluster", {
    name:  config.require("soc-id") + "-evs",
    initialNodeCount: 2,
    minMasterVersion: engineVersion,
    nodeVersion: engineVersion,
    location: config.require("zone"),
    nodeConfig: {
        machineType: config.require("node-type"),
        oauthScopes: [
            "https://www.googleapis.com/auth/compute",
            "https://www.googleapis.com/auth/devstorage.read_only",
            "https://www.googleapis.com/auth/logging.write",
            "https://www.googleapis.com/auth/monitoring"
        ],
    },
});

// Manufacture a GKE-style kubeconfig. Note that this is slightly "different"
// because of the way GKE requires gcloud to be in the picture for cluster
// authentication (rather than using the client cert/key directly).
var kubeconfig = pulumi.
    all([ cluster.name, cluster.endpoint, cluster.masterAuth ]).
    apply(([ name, endpoint, masterAuth ]) => {
        const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
        return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${masterAuth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    auth-provider:
      config:
        cmd-args: config config-helper --format=json
        cmd-path: gcloud
        expiry-key: '{.credential.token_expiry}'
        token-key: '{.credential.access_token}'
      name: gcp
`;
    });

// Create a Kubernetes provider instance that uses our cluster from above.
const clusterProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: kubeconfig,
});

const caKey = new tls.PrivateKey("ca-key", {
    algorithm: "ECDSA",
    ecdsaCurve: "P256"
});

const caCert = new tls.SelfSignedCert("ca-cert", {
    isCaCertificate: true,
    allowedUses: [
        "digital_signature", "cert_signing", "ocsp_signing",
        "crl_signing", "server_auth", "client_auth"
    ],
    keyAlgorithm: "ECDSA",
    privateKeyPem: caKey.privateKeyPem,
    subjects: [{
        commonName: "Cyberapocalypse CA",
        organizationalUnit: "Security",
        organization: "Cyberapocalypse"
    }],
    validityPeriodHours: 10000
});

const portalKey = new tls.PrivateKey("portal-key", {
    algorithm: "ECDSA",
    ecdsaCurve: "P256"
});

const portalReq = new tls.CertRequest("portal-req", {
    keyAlgorithm: "ECDSA",
    privateKeyPem: portalKey.privateKeyPem,
    subjects: [{
        commonName: "Cyberapocalypse portal cert",
        organizationalUnit: "Security",
        organization: "Cyberapocalypse"
    }],
    dnsNames: [
        config.require("portal-host"),
        config.require("accounts-host")
    ],
    ipAddresses: [ipAddress.address],
});

const portalCert = new tls.LocallySignedCert("portal-cert", {
    allowedUses: ["server_auth"],
    caCertPem: caCert.certPem,
    caKeyAlgorithm: "ECDSA",
    caPrivateKeyPem: caKey.privateKeyPem,
    certRequestPem: portalReq.certRequestPem,
    validityPeriodHours: 10000,
});

var portalCertBundle =
    pulumi.all([portalCert.certPem, caCert.certPem]).
    apply(([cert, ca]) => `${cert}${ca}`);

if (socNamespace != "default") {
    const namespace = new k8s.core.v1.Namespace("namespace",
        {
            metadata: {
                name: socNamespace
            }
        },
        {
            provider: clusterProvider
        }
    );
}

const portalSecret = new k8s.core.v1.Secret("portal-keys",
    {
        metadata: {
            name: "portal-keys",
            namespace: socNamespace
        },
        stringData: {
            "server.crt": portalCertBundle,
            "server.key": portalKey.privateKeyPem,
        }
    },
    {
        provider: clusterProvider
    }
);

exports.caCert = caCert.certPem;

const hadoop = require("./hadoop.js");
hadoop.resources(config, clusterProvider);

const zookeeper = require("./zookeeper.js");
zookeeper.resources(config, clusterProvider);

const accumulo = require("./accumulo.js");
accumulo.resources(config, clusterProvider);

/*
const extResources = new k8s.yaml.ConfigFile("k8s-resources", {
    file: "all.yaml",
    transformations: [
        (obj) => {
            if (obj.kind == "Service" && obj.metadata.name == "portal") {
                obj.spec.loadBalancerIP = ipAddress.address
            }
        },
        (obj) => {
            if ("metadata" in obj) {
                if ("namespace" in obj.metadata) {
                    obj.metadata.namespace = socNamespace;
                }
            }
        },
        (obj) => {
            if (obj.kind == "Deployment" && obj.metadata.name == "keycloak") {
                var envs = obj.spec.template.spec.containers[0].env;
                for (v in envs) {
                    if (envs[v].name == "KEYCLOAK_PASSWORD") {
                        envs[v].value = config.require("keycloak-admin-password");
                    }
                }
            }
        }
    ],
},
{
    provider: clusterProvider
});


const kDeploy = extResources.getResource("apps/v1/Deployment", "s01", "keycloak");
const kService = extResources.getResource("v1/Service", "s01", "keycloak");
const nDeploy = extResources.getResource("apps/v1/Deployment", "s01", "nginx");
const pService = extResources.getResource("v1/Service", "s01", "portal");

// Can't interact with keycloak until  these resources are running.
kcResources = [ kDeploy, kService, nDeploy, pService ];

const authProvider = new keycloak.Provider("keycloak", {
    clientId:  "admin-cli",
    username: "admin",
    password: config.require("keycloak-admin-password"),
    realm: "master",
    url: "https://" + config.require("accounts-host") + "/",
    rootCaCertificate: caCert.certPem,
    initialLogin: false
}, {
    dependsOn: kcResources
});

const realm = new keycloak.Realm("auth-realm", {
    realm: "cyberapocalypse",
    displayName: "Cyberapocalypse authentication realm",
    enabled: true
}, {
    provider: authProvider,
    dependsOn: kcResources
});

const openidClient = new keycloak.openid.Client("auth-client", {
    accessType: "PUBLIC",
    clientId: "cyberapocalypse",
    name: "cyberapocalypse",
    descrption: "cyberapocalypse authentication portal",
    enabled: true,
    realmId: realm.id,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    rootUrl: "https://" + config.require("portal-host") + "/",
    adminUrl: "https://" + config.require("portal-host") + "/",
    webOrigins: ["https://" + config.require("portal-host") + "/"],
    validRedirectUris: ["https://" + config.require("portal-host") + "/*"],
}, {
    provider: authProvider,
    dependsOn: [
        extResources.getResource("Service", "keycloak"),
        extResources.getResource("Deployment", "keycloak")
    ]
});

const user = new keycloak.User("auth-user", {
    email: config.require("initial-email"),
    enabled: true,
    initialPassword: {
        temporary: true,
        value: config.require("initial-password"),
    },
    realmId: realm.id,
    username: config.require("initial-user"),
}, {
    provider: authProvider,
    dependsOn: [
        extResources.getResource("Service", "keycloak"),
        extResources.getResource("Deployment", "keycloak")
    ]
});




*/
