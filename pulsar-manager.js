
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {
    return [
        new k8s.apps.v1.Deployment("pulsar-manager", {
            "metadata": {
                "name": "pulsar-manager",
                "labels": {
                    "instance": "pulsar-manager",
                    "app": "pulsar-manager",
                    "component": "pulsar"
                },
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "replicas": 1,
                "selector": {
                    "matchLabels": {
                        "instance": "pulsar-manager",
                        "app": "pulsar-manager",
                        "component": "pulsar"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "instance": "pulsar-manager",
                            "app": "pulsar-manager",
                            "component": "pulsar"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "env": [
                                    {
                                        "name": "DRIVER_CLASS_NAME",
                                        "value": "org.postgresql.Driver"
                                    },
                                    {
                                        "name": "URL",
                                        "value": "jdbc:postgresql://127.0.0.1:5432/pulsar_manager"
                                    },
                                    {
                                        "name": "USERNAME",
                                        "value": "pulsar"
                                    },
                                    {
                                        "name": "PASSWORD",
                                        "value": "pulsar"
                                    },
                                    {
                                        "name": "LOG_LEVEL",
                                        "value": "DEBUG"
                                    },
                                    {
                                        "name": "REDIRECT_HOST",
                                        "value": "http://127.0.0.1"
                                    },
                                    {
                                        "name": "REDIRECT_PORT",
                                        "value": "8080"
                                    }
                                ],
                                "image": "apachepulsar/pulsar-manager:v0.1.0",
                                "name": "pulsar-manager",
                                "ports": [
                                    {
                                        "containerPort": 9527,
                                        "name": "ui"
                                    }
                                ],
                                "resources": {
                                    "limits": {
                                        "cpu": "1.0",
                                        "memory": "512M"
                                    },
                                    "requests": {
                                        "cpu": "0.1",
                                        "memory": "512M"
                                    }
                                },
                                "volumeMounts": [
                                    {
                                        "mountPath": "/data",
                                        "name": "data",
                                        "readOnly": false
                                    }
                                ]
                            }
                        ],
                        "volumes": [
                            {
                                "name": "data",
                                "persistentVolumeClaim": {
                                    "claimName": "pulsar-manager"
                                }
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("pulsar-manager", {
            "metadata": {
                "labels": {
                    "app": "pulsar-manager",
                    "component": "pulsar"
                },
                "name": "pulsar-manager",
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "ports": [
                    {
                        "name": "ui",
                        "port": 9527,
                        "protocol": "TCP",
                        "targetPort": 9527
                    }
                ],
                "selector": {
                    "app": "pulsar-manager",
                    "component": "pulsar"
                }
            }
        }, {
            provider: provider
        }),
        new k8s.storage.v1.StorageClass("pulsar-manager", {
            "metadata": {
                "name": "pulsar-manager",
                "labels": {
                    "app": "pulsar-manager",
                    "component": "pulsar"
                }
            },
            "parameters": {
                "type": "pd-ssd"
            },
            "provisioner": "kubernetes.io/gce-pd",
            "reclaimPolicy": "Retain"
        }, {
            provider: provider
        }),
        new k8s.core.v1.PersistentVolumeClaim("pulsar-manager", {
            "metadata": {
                "name": "pulsar-manager",
                "labels": {
                    "app": "pulsar-manager",
                    "component": "pulsar"
                },
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "accessModes": [
                    "ReadWriteOnce"
                ],
                "resources": {
                    "requests": {
                        "storage": "10G"
                    }
                },
                "storageClassName": "pulsar-manager",
                "volumeMode": "Filesystem"
            }
        }, {
            provider: provider
        })
    ];
};



        
        
