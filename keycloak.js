
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {

    const volSize = config.get("keycloak-volume-size") ?
          config.get("keycloak-volume-size") : "5G";

    const volType = config.get("keycloak-volume-type") ?
          config.get("keycloak-volume-type") : "pd-standard";

    return [

        new k8s.apps.v1.Deployment("keycloak", {
            metadata: {
                name: "keycloak",
                labels: {
                    instance: "keycloak",
                    app: "keycloak",
                    component: "keycloak"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: "keycloak",
                        app: "keycloak",
                        component: "keycloak"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: "keycloak",
                            app: "keycloak",
                            component: "keycloak"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                name: "keycloak",
                                image: "jboss/keycloak:10.0.2",
                                env: [
                                    {
                                        name: "KEYCLOAK_USER",
                                        valueFrom: {
                                            secretKeyRef: {
                                                name: "keycloak-admin-keys",
                                                key: "username"
                                            }
                                        }
                                    },
                                    {
                                        name: "KEYCLOAK_PASSWORD",
                                        valueFrom: {
                                            secretKeyRef: {
                                                name: "keycloak-admin-keys",
                                                key: "password"
                                            }
                                        }
                                    },
                                    {
                                        name: "JAVA_OPTS",
                                        value: "-Xms128m -Xmx256m"
                                    },
                                    {
                                        name: "KEYCLOAK_FRONTEND_URL",
                                        value: "https://" + config.require("accounts-host") + "/auth"
                                    },
                                    {
                                        name: "PROXY_ADDRESS_FORWARDING",
                                        value: "true"
                                    }
                                ],
                                ports: [
                                    {
                                        containerPort: 8080,
                                        name: "http"
                                    }
                                ],
                                resources: {
                                    limits: {
                                        cpu: "1.0",
                                        memory: "512M"
                                    },
                                    requests: {
                                        cpu: "0.05",
                                        memory: "512M"
                                    }
                                },
                                volumeMounts: [
                                    {
                                        mountPath: "/opt/jboss/keycloak/standalone/data",
                                        name: "data",
                                        readOnly: false
                                    }
                                ],
                                readinessProbe: {
                                    initialDelaySeconds: 90,
                                    periodSeconds: 5,
                                    httpGet: {
                                        port: 8080,
                                        path: "/"
                                    }
                                },
                                livenessProbe: {
                                    initialDelaySeconds: 90,
                                    periodSeconds: 10,
                                    httpGet: {
                                        port: 8080,
                                        path: "/"
                                    }
                                }
                            }
                        ],
                        securityContext: {
                            fsGroup: 0,
                            runAsGroup: 0,
                            runAsUser: 1000
                        },
                        volumes: [
                            {
                                name: "data",
                                persistentVolumeClaim: {
                                    claimName: "keycloak"
                                }
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),

        new k8s.core.v1.Secret("keycloak-admin-keys", {
            metadata: {
                name: "keycloak-admin-keys",
                namespace: config.require("k8s-namespace")
            },
            stringData: {
                "username": "admin",
                "password": config.requireSecret("keycloak-admin-password")
            }
        }, {
            provider: provider
        }),

        new k8s.core.v1.Service("keycloak", {
            metadata: {
                name: "keycloak",
                labels: {
                    app: "keycloak",
                    component: "keycloak"
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
                    app: "keycloak",
                    component: "keycloak"
                }
            }
        }, {
            provider: provider
        }),
        
        new k8s.storage.v1.StorageClass("keycloak", {
            metadata: {
                name: "keycloak",
                labels: {
                    app: "keycloak",
                    component: "keycloak"
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

        new k8s.core.v1.PersistentVolumeClaim("keycloak", {
            metadata: {
                name: "keycloak",
                labels: {
                    app: "keycloak",
                    component: "keycloak"
                },
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
                storageClassName: "keycloak",
                volumeMode: "Filesystem"
            }
        }, {
            provider: provider
        })

    ];

}

