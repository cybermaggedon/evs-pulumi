
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

exports.resources = function(config, provider, required) {
    return [
        new k8s.apps.v1.Deployment("cybermon", {
            metadata: {
                labels: {
                    app: "cybermon",
                    component: "cybermon",
                    instance: "cybermon"
                },
                name: "cybermon",
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        app: "cybermon",
                        component: "cybermon",
                        instance: "cybermon"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            app: "cybermon",
                            component: "cybermon",
                            instance: "cybermon"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                command: [
                                    "cybermon",
                                    "-p",
                                    "9000",
                                    "-c",
                                    "/usr/local/share/cyberprobe/protostream.lua"
                                ],
                                env: [
                                    {
                                        name: "PULSAR_BROKER",
                                        value: "ws://exchange:8080"
                                    }
                                ],
                                image: "docker.io/cybermaggedon/cyberprobe:2.5.1",
                                name: "cybermon",
                                ports: [
                                    {
                                        containerPort: 9000,
                                        name: "etsi"
                                    },
                                    {
                                        containerPort: 8088,
                                        name: "metrics"
                                    }
                                ],
                                resources: {
                                    limits: {
                                        cpu: "1.0",
                                        memory: "256M"
                                    },
                                    requests: {
                                        cpu: "0.1",
                                        memory: "256M"
                                    }
                                },
                                volumeMounts: [
                                    {
                                        mountPath: "/usr/local/share/cyberprobe",
                                        name: "config",
                                        readOnly: false
                                    }
                                ]
                            },
                            {
                                image: "docker.io/cybermaggedon/evs-input:0.4.2",
                                name: "evs-input",
                                resources: {
                                    limits: {
                                        cpu: "1.0",
                                        memory: "128M"
                                    },
                                    requests: {
                                        cpu: "0.1",
                                        memory: "128M"
                                    }
                                }
                            }
                        ],
                        volumes: [
                            {
                                configMap: {
                                    name: "cybermon-config"
                                },
                                name: "config"
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider,
            dependsOn: required
        }),
        new k8s.core.v1.Service("cybermon", {
            metadata: {
                labels: {
                    app: "cybermon",
                    component: "cybermon"
                },
                name: "cybermon",
                namespace: config.require("k8s-namespace")
            },
            spec: {
                ports: [
                    {
                        name: "etsi",
                        port: 9000,
                        protocol: "TCP",
                        targetPort: 9000
                    },
                    {
                        name: "metrics",
                        port: 8088,
                        protocol: "TCP",
                        targetPort: 8088
                    }
                ],
                selector: {
                    app: "cybermon",
                    component: "cybermon"
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("cybermon-config", {
            metadata: {
                labels: {
                    app: "cybermon",
                    component: "cybermon"
                },
                name: "cybermon-config",
                namespace: config.require("k8s-namespace")
            },
            data: {
                "protostream.lua": fs.readFileSync("protostream.lua", "utf-8")
            }
        }, {
            provider: provider
        })
    ];

}
