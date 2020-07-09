
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {

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
                "prometheus.yml": "global:\n\n  # Set the scrape interval to every 15 seconds. Default is every 1 minute.\n  scrape_interval:     15s \n\n  # Evaluate rules every 15 seconds. The default is every 1 minute.\n  evaluation_interval: 15s \n\n  # scrape_timeout is set to the global default (10s).\n\n# Alertmanager configuration\nalerting:\n  alertmanagers:\n  - static_configs:\n    - targets:\n      # - alertmanager:9093\n\n# Load rules once and periodically evaluate them according to the global 'evaluation_interval'.\nrule_files:\n  # - \"first_rules.yml\"\n  # - \"second_rules.yml\"\n\n# A scrape configuration containing exactly one endpoint to scrape:\n# Here it's Prometheus itself.\nscrape_configs:\n\n# The job name is added as a label `job=<job_name>` to any timeseries\n# scraped from this config.\n- job_name: 'kubernetes-service-endpoints'\n\n  kubernetes_sd_configs:\n  - role: endpoints\n    namespaces:\n      names:\n      - cyberapocalypse\n\n  relabel_configs:\n\n  # Relabel to scrape only endpoints that have\n  # \"prometheus.io/scrape = true\" annotation.\n#   - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]\n#     action: keep\n#     regex: true\n\n  # Relabel to customize metric path based on endpoints\n  # \"prometheis.io/metric_path = <metric path>\" annotation.\n  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_metric_path]\n    action: replace\n    target_label: __metrics_path__\n    regex: (.+)\n\n  # Relabel to scrape only single, desired port for the service based\n  # on endpoints \"prometheus.io/scrape_port = <port>\" annotation.\n  - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_scrape_port]\n    action: replace\n    regex: ([^:]+)(?::\\d+)?;(\\d+)\n    replacement: $1:$2\n    target_label: __address__\n\n  # Example relabel to configure scrape scheme for all service scrape targets\n  # based on endpoints \"prometheus.io/scrape_scheme = <scheme>\" annotation.\n  - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape_scheme]\n    action: replace\n    target_label: __scheme__\n    regex: (https?)\n\n  - action: labelmap\n    regex: __meta_kubernetes_service_label_(.+)\n\n  - source_labels: [__meta_kubernetes_namespace]\n    action: replace\n    target_label: kubernetes_namespace\n\n  - source_labels: [__meta_kubernetes_service_name]\n    action: replace\n    target_label: kubernetes_name\n\n"
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


                                          
