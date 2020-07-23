
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

exports.resources = function(config, provider) {

    return [
        new k8s.apps.v1.Deployment("ui", {
            metadata: {
                name: "ui",
                labels: {
                    instance: "ui",
                    app: "ui",
                    component: "ui"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: "ui",
                        app: "ui",
                        component: "ui"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: "ui",
                            app: "ui",
                            component: "ui"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                name: "ui",
                                image: "docker.io/cybermaggedon/evs-web:0.4",
                                ports: [
                                    {
                                        containerPort: 8080,
                                        name: "http"
                                    }
                                ],
                                resources: {
                                    limits: {
                                        cpu: "0.2",
                                        memory: "128M"
                                    },
                                    requests: {
                                        cpu: "0.05",
                                        memory: "128M"
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("ui", {
            metadata: {
                name: "ui",
                labels: {
                    app: "ui",
                    component: "ui"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                ports: [
                    {
                        name: "http",
                        port: 8080,
                        protocol: "TCP",
                        targetPort: 8080
                    }
                ],
                selector: {
                    app: "ui",
                    component: "ui"
                }
            }
        }, {
            provider: provider
        })
    ];
}

