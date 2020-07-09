
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

exports.resources = function(config, provider) {

    return [
        new k8s.apps.v1.Deployment("grafana", {
            "metadata": {
                "name": "grafana",
                "labels": {
                    "instance": "grafana", "app": "grafana",
                    "component": "grafana"
                },
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "replicas": 1,
                "selector": {
                    "matchLabels": {
                        "instance": "grafana", "app": "grafana",
                        "component": "grafana"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "instance": "grafana", "app": "grafana",
                            "component": "grafana"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "name": "grafana",
                                "image": "grafana/grafana:7.0.3",
                                "env": [
                                    {
                                        "name": "GF_SERVER_ROOT_URL",
                                        "value": "https://" + config.require("portal-host") + "/grafana"
                                    },
                                    {
                                        "name": "GF_AUTH_ANONYMOUS_ENABLED",
                                        "value": "true"
                                    },
                                    {
                                        "name": "GF_ORG_NAME",
                                        // FIXME
                                        "value": "cyberapocalypse"
                                    },
                                    {
                                        "name": "GF_AUTH_ANONYMOUS_ORG_ROLE",
                                        "value": "Admin"
                                    }
                                ],
                                "ports": [
                                    {
                                        "containerPort": 3000,
                                        "name": "grafana"
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
                                        "mountPath": "/etc/grafana/provisioning/datasources",
                                        "name": "datasource-provision",
                                        "readOnly": true
                                    },
                                    {
                                        "mountPath": "/etc/grafana/provisioning/dashboards",
                                        "name": "dashboard-provision",
                                        "readOnly": true
                                    },
                                    {
                                        "mountPath": "/var/lib/grafana/dashboards",
                                        "name": "dashboards",
                                        "readOnly": true
                                    }
                                ]
                            }
                        ],
                        "volumes": [
                            {
                                "configMap": {
                                    "name": "grafana-dashboard-prov"
                                },
                                "name": "dashboard-provision"
                            },
                            {
                                "configMap": {
                                    "name": "grafana-dashboards"
                                },
                                "name": "dashboards"
                            },
                            {
                                "configMap": {
                                    "name": "grafana-datasource-prov"
                                },
                                "name": "datasource-provision"
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("grafana", {
         "kind": "Service",
         "metadata": {
            "name": "grafana",
            "labels": {
               "app": "grafana",
               "component": "grafana"
            },
             "namespace": config.require("k8s-namespace")
         },
         "spec": {
             "ports": [
                 {
                     "name": "grafana",
                     "port": 3000,
                     "protocol": "TCP",
                     "targetPort": 3000
                 }
             ],
             "selector": {
                 "app": "grafana",
                 "component": "grafana"
             }
         }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("grafana-dashboard-prov", {
            "metadata": {
                "name": "grafana-dashboard-prov",
                "labels": {
                    "app": "grafana",
                    "component": "grafana"
                },
                "namespace": config.require("k8s-namespace")
            },
            "data": {
                "dashboard.yml":
                fs.readFileSync("grafana/dashboard.yml", "utf-8")
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("grafana-datasource-prov", {
            "metadata": {
                "name": "grafana-datasource-prov",
                "labels": {
                    "app": "grafana",
                    "component": "grafana"
                },
                "namespace": config.require("k8s-namespace")
            },
            "data": {
                "datasource.yml":
                fs.readFileSync("grafana/datasource.yml", "utf-8")
            }
        }, {
            provider: provider
        }),

        new k8s.core.v1.ConfigMap("grafana-dashboards", {
            "metadata": {
                "name": "grafana-dashboards",
                "labels": {
                    "app": "grafana",
                    "component": "grafana"
                },
                "namespace": config.require("k8s-namespace")
            },
            "data": {
                "dashboard.json":
                fs.readFileSync("grafana/dashboard.json", "utf-8")
            }
        }, {
            provider: provider
        })
    ]
}

