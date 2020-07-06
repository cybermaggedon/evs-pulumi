const gcp = require("@pulumi/gcp");
const k8s =  require("@pulumi/kubernetes");
const pulumi = require("@pulumi/pulumi");
const tls = require("@pulumi/tls");

var region = "us-east1";
var zone = "us-east1-d";
var nodeType = "n1-standard-1";
var domain = "cyberapocalypse.co.uk";
var accountsHost = "accounts.portal." + domain;
var portalHost = "portal.portal." + domain;
var dnsZone = "portal";
var k8sNamespace = "cyberapocalypse";

const ipAddress = new gcp.compute.Address("address", {
    name: "evs",
    region: region
});

const envDnsZone = gcp.dns.getManagedZone({
    name: dnsZone,
});

const portalDns = new gcp.dns.RecordSet("portal-dns", {
    name: portalHost,
    type: "A",
    ttl: 300,
    managedZone: envDnsZone.then(envDnsZone => envDnsZone.name),
    rrdatas: [ipAddress.address],
});
              
const accountsDns = new gcp.dns.RecordSet("account-dns", {
    name: accountsHost,
    type: "A",
    ttl: 300,
    managedZone: envDnsZone.then(envDnsZone => envDnsZone.name),
    rrdatas: [ipAddress.address],
});

const engineVersion = gcp.container.getEngineVersions({
    location: zone
}).then(v => v.latestMasterVersion);

const cluster = new gcp.container.Cluster("cluster", {
    name:  "evs",
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
    allowedUses: ["digital_signature"],
    keyAlgorithm: "ECDSA",
    privateKeyPem: caKey.privateKeyPem,
    subjects: [{
        commonName: "Cyberapocalypse CA"
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
exports.portalAddress = ipAddress.address;
    
const extResources = new k8s.yaml.ConfigFile("evs-resources", {
    file: "all.yaml",
    transformations: [(obj) => {
        if (obj.kind == "Service" && obj.metadata.name == "portal") {
            obj.spec.loadBalancerIP = ipAddress.address
        }
    }],

},
{
    provider: clusterProvider
});
