
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

exports.resources = function(config, provider) {

    return [
        new k8s.apps.v1.Deployment("fair-service", {
            metadata: {
                name: "fair-service",
                labels: {
                    instance: "fair-service",
                    app: "fair-service",
                    component: "fair-service"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: "fair-service",
                        app: "fair-service",
                        component: "fair-service"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: "fair-service",
                            app: "fair-service",
                            component: "fair-service"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                name: "fair-service",
                                image: "docker.io/cybermaggedon/fair-service:0.2",
                                ports: [
                                    {
                                        containerPort: 8080,
                                        name: "http"
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
                                }
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("fair-service", {
            metadata: {
                name: "fair-service",
                labels: {
                    app: "fair-service",
                    component: "fair-service"
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
                    app: "fair-service",
                    component: "fair-service"
                }
            }
        }, {
            provider: provider
        })
    ];
}

