const gcp = require("@pulumi/gcp");
const k8s =  require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");
const tls = require("@pulumi/tls");
const keycloak = require("@pulumi/keycloak");

var socId  = "s01";

var region = "us-east1";
var zone = "us-east1-d";
var nodeType = "n1-standard-1";
var domain = "cyberapocalypse.co.uk";
var accountsHost = "accounts." + socId + ".portal." + domain;
var portalHost = socId + ".portal." + domain;
var dnsZone = "portal";
var k8sNamespace = "cyberapocalypse";

var keycloakAdminPassword = "CHANGEME";

var initialUser = "user";
var initialEmail = "user@cyberapocalypse.co.uk";
var initialPassword = "CHANGEMENOW";

const ipAddress = new gcp.compute.Address("address", {
    name: socId + "-evs",
    region: region
});

const envDnsZone = gcp.dns.getManagedZone({
    name: dnsZone,
});

const portalDns = new gcp.dns.RecordSet("portal-dns", {
    name: portalHost + ".",
    type: "A",
    ttl: 300,
    managedZone: envDnsZone.then(envDnsZone => envDnsZone.name),
    rrdatas: [ipAddress.address],
});
              
const accountsDns = new gcp.dns.RecordSet("account-dns", {
    name: accountsHost + ".",
    type: "A",
    ttl: 300,
    managedZone: envDnsZone.then(envDnsZone => envDnsZone.name),
    rrdatas: [ipAddress.address],
});

const engineVersion = gcp.container.getEngineVersions({
    location: zone
}).then(v => v.latestMasterVersion);

const cluster = new gcp.container.Cluster("cluster", {
    name:  socId + "-evs",
    initialNodeCount: 6,
    minMasterVersion: engineVersion,
    nodeVersion: engineVersion,
    location: zone,
    nodeConfig: {
        machineType: nodeType,
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
    dnsNames: [ portalHost, accountsHost ],
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

const namespace = new k8s.core.v1.Namespace("namespace",
    {
        metadata: {
            name: k8sNamespace
        }
    },
    {
        provider: clusterProvider
    }
);

const portalSecret = new k8s.core.v1.Secret("portal-keys",
    {
        metadata: {
            name: "portal-keys",
            namespace: k8sNamespace,
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

const extResources = new k8s.yaml.ConfigFile("k8s-resources", {
    file: "all.yaml",
    transformations: [
        (obj) => {
            if (obj.kind == "Service" && obj.metadata.name == "portal") {
                obj.spec.loadBalancerIP = ipAddress.address
             }
        },
        (obj) => {
            if (obj.kind == "Deployment" && obj.metadata.name == "keycloak") {
                obj.spec.template.spec.containers[0].env[1].value =
                    keycloakAdminPassword;
            }
        },
    ],
},
{
    provider: clusterProvider
});

const authProvider = new keycloak.Provider("keycloak", {
    clientId:  "admin-cli",
    username: "admin",
    password: keycloakAdminPassword,
    realm: "master",
    url: "https://" + accountsHost + "/",
    rootCaCertificate: caCert.certPem
});

const realm = new keycloak.Realm("auth-realm", {
    realm: "cyberapocalypse",
    displayName: "Cyberapocalypse authentication realm",
    enabled: true
}, {
    provider: authProvider
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
    rootUrl: "https://" + portalHost + "/",
    adminUrl: "https://" + portalHost + "/",
    webOrigins: ["https://" + portalHost + "/"],
    validRedirectUris: ["https://" + portalHost + "/*"],
}, {
    provider: authProvider
});

const user = new keycloak.User("auth-user", {
    email: initialEmail,
    enabled: true,
    initialPassword: {
        temporary: true,
        value: initialPassword,
    },
    realmId: realm.id,
    username: initialUser,
}, {
    provider: authProvider
});

exports.adminPassword = keycloakAdminPassword;
exports.user = initialUser;
exports.password = initialPassword;

