
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

exports.resources = function(config, provider) {

    const prom_conf = fs.readFileSync("prometheus-config.yml", "utf-8").
          replace(/%K8S-NAMESPACE%/g, config.require("k8s-namespace"));

    return [
        new k8s.apps.v1.Deployment("prometheus", {
            "name": "prometheus",
            "metadata": {
                "labels": {
                    "instance": "prometheus",
                    "app": "prometheus",
                    "component": "prometheus"
                },
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "replicas": 1,
                "selector": {
                    "matchLabels": {
                        "instance": "prometheus",
                        "app": "prometheus",
                        "component": "prometheus"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "instance": "prometheus",
                            "app": "prometheus",
                            "component": "prometheus"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "name": "prometheus",
                                "image": "prom/prometheus:v2.19.1",
                                "args": [
                                    "--web.external-url=https://" + config.require("portal-host") + "/prometheus/",
                                    "--web.route-prefix=/",
                                    "--config.file=/etc/prometheus/prometheus.yml",
                                    "--storage.tsdb.path=/prometheus",
                                    "--web.console.libraries=/usr/share/prometheus/console_libraries",
                                    "--web.console.templates=/usr/share/prometheus/consoles"
                                ],
                                "env": [ ],
                                "ports": [
                                    {
                                        "containerPort": 9090,
                                        "name": "prometheus"
                                    }
                                ],
                                "resources": {
                                    "limits": {
                                        "cpu": "1.0",
                                        "memory": "256M"
                                    },
                                    "requests": {
                                        "cpu": "0.05",
                                        "memory": "256M"
                                    }
                                },
                                "volumeMounts": [
                                    {
                                        "mountPath": "/etc/prometheus",
                                        "name": "config",
                                        "readOnly": true
                                    }
                                ]
                            }
                        ],
                        "serviceAccountName": "prometheus",
                        "volumes": [
                            {
                                "configMap": {
                                    "name": "prometheus-config"
                                },
                                "name": "config"
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("prometheus", {
            "metadata": {
                "labels": {
                    "app": "prometheus",
                    "component": "prometheus"
                },
                "name": "prometheus",
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "ports": [
                    {
                        "name": "prometheus",
                        "port": 9090,
                        "protocol": "TCP",
                        "targetPort": 9090
                    }
                ],
                "selector": {
                    "app": "prometheus",
                    "component": "prometheus"
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("prometheus-config", {
            "metadata": {
                "name": "prometheus-config",
                "labels": {
                    "app": "prometheus",
                    "component": "prometheus"
                },
                "namespace": config.require("k8s-namespace")
            },
            "data": {
                "prometheus.yml": prom_conf
            }
        }, {
            provider: provider
        }),
        new k8s.rbac.v1.ClusterRole("prometheus", {
            "metadata": {
                "name": "prometheus",
                "namespace": config.require("k8s-namespace")
            },
            "rules": [
                {
                    "apiGroups": [ "" ],
                    "resources": [
                        "nodes",
                        "nodes/proxy",
                        "services",
                        "endpoints",
                        "pods"
                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                },
                {
                    "apiGroups": [
                        "extensions"
                    ],
                    "resources": [
                        "ingresses"
                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                },
                {
                    "nonResourceURLs": [
                        "/metrics"
                    ],
                    "verbs": [ "get" ]
            }
         ]
        }, {
            provider: provider
        }),
        new k8s.core.v1.ServiceAccount("prometheus", {
            "metadata": {
                "name": "prometheus",
                "namespace": config.require("k8s-namespace")
            }
        }, {
            provider: provider
        }),
        new k8s.rbac.v1.ClusterRoleBinding("prometheus", {
            "metadata": {
                "name": "prometheus",
                "namespace": config.require("k8s-namespace")
            },
            "roleRef": {
                "apiGroup": "rbac.authorization.k8s.io",
                "kind": "ClusterRole",
                "name": "prometheus"
            },
            "subjects": [
                {
                    "kind": "ServiceAccount",
                    "name": "prometheus",
                    "namespace": config.require("k8s-namespace")
                }
            ]
        }, {
            provider: provider
        })
    ];
}


                                          
