
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const name = "cassandra";
const images = ["cassandra:3.11.6"];

const resources = function(config, provider) {

    const volSize = config.get("cassandra-volume-size") ?
          config.get("cassandra-volume-size") : "10G";

    const volType = config.get("cassandra-volume-type") ?
          config.get("cassandra-volume-type") : "pd-ssd";

    const containerPorts = [
        { name: "cassandra", containerPort: 9042 }
    ];

    const env = [
        // Memory usage low
        { name: "JVM_OPTS", value: "-Xms64M -Xmx256M" }
    ];

    const containers = [
        {
            name: "cassandra",
            image: images[0],
            env: env,
            ports: containerPorts,
            resources: {
                limits: { cpu: "1.0", memory: "512M" },
                requests: { cpu: "0.1", memory: "512M" },
            },
            volumeMounts: [
                { name: "data", mountPath: "/var/lib/cassandra" }
            ]
        }
    ];

    const deployment = new k8s.apps.v1.Deployment("cassandra", {
        metadata: {
            name: name,
            namespace: config.require("k8s-namespace"),
            labels: {
                instance: "cassandra", app: "cassandra",
                component: "cassandra"
            },
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    instance: "cassandra", app: "cassandra",
                    component: "cassandra"
                }
            },
            template: {
                metadata: {
                    labels: {
                        instance: "cassandra", app: "cassandra",
                        component: "cassandra"
                    }
                },
                spec: {
                    containers: containers,
                    volumes: [
                        {
                            name: "data",
                            persistentVolumeClaim: {
                                claimName: "cassandra"
                            }
                        }
                    ]
                }
            }
        }
    }, {
        provider: provider
    });

    const storageClass = new k8s.storage.v1.StorageClass("cassandra", {
        metadata: {
            name: "cassandra",
            labels: { app: "cassandra", component: "cassandra" },
        },
        parameters: { type: volType },
        provisioner: "kubernetes.io/gce-pd",
        reclaimPolicy:  "Retain"
    }, {
        provider: provider
    });

    const pvc =
        new k8s.core.v1.PersistentVolumeClaim(name, {
            metadata: {
                name: name,
                namespace: config.require("k8s-namespace"),
                labels: { instance: "cassandra", app: "cassandra",
                          component: "cassandra" }
            },
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: {
                    requests: { storage: volSize }
                },
                storageClassName: "cassandra",
                volumeMode: "Filesystem"
            }
        }, {
            provider: provider
        });
    
    const svc =
          new k8s.core.v1.Service("cassandra", {
              metadata: {
                  name: "cassandra",
                  namespace: config.require("k8s-namespace"),
                  labels: { app: "cassandra", component: "cassandra" }
              },
              spec: {
                  ports: [
                      { name: "cassandra", port: 9200, targetPort: 9200,
                        protocol: "TCP" }
                  ],
                  selector: {
                      instance: "cassandra",
                      app: "cassandra",
                      component: "cassandra"
                  }
              }
          }, {
              provider: provider
          });

    return [ deployment, storageClass, pvc, svc ];
    
};

exports.name = name;
exports.images = images;
exports.resources = resources;

