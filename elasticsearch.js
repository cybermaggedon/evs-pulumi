
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const name = "elasticsearch";
const images = ["elasticsearch:7.7.1"];

const resources = function(config, provider) {

    const volSize = config.get("elasticsearch-volume-size") ?
          config.get("elasticsearch-volume-size") : "10G";

    const volType = config.get("elasticsearch-volume-type") ?
          config.get("elasticsearch-volume-type") : "pd-ssd";

    const containerPorts = [
        { name: "elasticsearch", containerPort: 9200 }
    ];

    const env = [

        // Single node
        { name: "discovery.type", value: "single-node" },

        // Memory usage low
        { name: "ES_JAVA_OPTS", value: "-Xms128M -Xmx256M" }
        
    ]

    const containers = [
        {
            name: "elasticsearch",
            image: images[0],
            env: env,
            ports: containerPorts,
            resources: {
                limits: { cpu: "1.0", memory: "1G" },
                requests: { cpu: "0.1", memory: "1G" },
            },
            volumeMounts: [
                { name: "data", mountPath: "/usr/share/elasticsearch/data" }
            ]
        }
    ];

    const deployment = new k8s.apps.v1.Deployment("elasticsearch", {
        metadata: {
            name: name,
            namespace: config.require("k8s-namespace"),
            labels: {
                instance: "elasticsearch", app: "elasticsearch",
                component: "elasticsearch"
            },
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    instance: "elasticsearch", app: "elasticsearch",
                    component: "elasticsearch"
                }
            },
            template: {
                metadata: {
                    labels: {
                        instance: "elasticsearch", app: "elasticsearch",
                        component: "elasticsearch"
                    }
                },
                spec: {
                    initContainers: [
                        {
                            name:  "sysctl",
                            image: "busybox:1.28",
                            command: [
                                "sysctl", "-w", "vm.max_map_count=262144"
                            ],
                            securityContext: { privileged: true }
                        }
                    ],
                    containers: containers,
                    volumes: [
                        {
                            name: "data",
                            persistentVolumeClaim: {
                                claimName: "elasticsearch"
                            }
                        }
                    ],
                    securityContext: {
                        runAsUser: 1000,
                        runAsGroup: 0,
                        fsGroup: 0
                    }
                }
            }
        }
    }, {
        provider: provider
    });

    const storageClass = new k8s.storage.v1.StorageClass("elasticsearch", {
        metadata: {
            name: "elasticsearch",
            labels: { app: "elasticsearch", component: "elasticsearch" },
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
                labels: { instance: "elasticsearch", app: "elasticsearch",
                          component: "elasticsearch" }
            },
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: {
                    requests: { storage: volSize }
                },
                storageClassName: "elasticsearch",
                volumeMode: "Filesystem"
            }
        }, {
            provider: provider
        });
    
    const svc =
          new k8s.core.v1.Service("elasticsearch", {
              metadata: {
                  name: "elasticsearch",
                  namespace: config.require("k8s-namespace"),
                  labels: { app: "elasticsearch", component: "elasticsearch" }
              },
              spec: {
                  ports: [
                      { name: "elasticsearch", port: 9200, targetPort: 9200,
                        protocol: "TCP" }
                  ],
                  selector: {
                      instance: "elasticsearch",
                      app: "elasticsearch",
                      component: "elasticsearch"
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

