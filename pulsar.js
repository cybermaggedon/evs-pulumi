
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {

    const volSize = config.get("pulsar-volume-size") ?
          config.get("pulsar-volume-size") : "10G";

    const volType = config.get("pulsar-volume-type") ?
          config.get("pulsar-volume-type") : "pd-ssd";

    return [
        new k8s.apps.v1.Deployment("pulsar", {
            metadata: {
                name: "pulsar-0000",
                labels: {
                    instance: "pulsar-0000",
                    app: "pulsar",
                    component: "pulsar"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: "pulsar-0000",
                        app: "pulsar",
                        component: "pulsar",
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            app: "pulsar",
                            component: "pulsar",
                            instance: "pulsar-0000"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                command: [ "bin/pulsar", "standalone" ],
                                env: [
                                    {
                                        name: "PULSAR_MEM",
                                        value: "-Xms128M -Xmx300M"
                                    }
                                ],
                                image: "apachepulsar/pulsar:2.5.1",
                                name: "pulsar",
                                ports: [
                                    {
                                        containerPort: 6650,
                                        name: "pulsar"
                                    },
                                    {
                                        containerPort: 8080,
                                        name: "websocket"
                                    }
                                ],
                                resources: {
                                    limits: {
                                        cpu: "1.0",
                                        memory: "700M"
                                    },
                                    requests: {
                                        cpu: "0.1",
                                        memory: "700M"
                                    }
                                },
                                volumeMounts: [
                                    {
                                        mountPath: "/pulsar/data",
                                        name: "data",
                                        readOnly: false
                                    }
                                ]
                            }
                        ],
                        volumes: [
                            {
                                name: "data",
                                persistentVolumeClaim: {
                                    claimName: "pulsar-0000"
                                }
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("exchange", {
            metadata: {
                name: "exchange",
                labels: {
                    app: "pulsar",
                    component: "pulsar"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                ports: [
                    {
                        name: "pulsar",
                        port: 6650,
                        protocol: "TCP",
                        targetPort: 6650
                    },
                    {
                        name: "websocket",
                        port: 8080,
                        protocol: "TCP",
                        targetPort: 8080
                    }
                ],
                selector: {
                    app: "pulsar",
                    component: "pulsar"
                }
            }
        }, {
            provider: provider
        }),
        new k8s.storage.v1.StorageClass("pulsar", {
            metadata: {
                name: "pulsar",
                labels: {
                    app: "pulsar",
                    component: "pulsar"
                },
            },
            parameters: {
                type: volType
            },
            provisioner: "kubernetes.io/gce-pd",
            reclaimPolicy: "Retain"
        }, {
            provider: provider
        }),
        new k8s.core.v1.PersistentVolumeClaim("pulsar", {
            metadata: {
                labels: {
                    app: "pulsar",
                    component: "pulsar"
                },
                name: "pulsar-0000",
                namespace: config.require("k8s-namespace")
            },
            spec: {
                accessModes: [
                    "ReadWriteOnce"
                ],
                resources: {
                    requests: {
                        storage: volSize
                    }
                },
                storageClassName: "pulsar",
                volumeMode: "Filesystem"
            }
        }, {
            provider: provider
        })
    ];
};

