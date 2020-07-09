
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

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
                "dashboard.yml": "apiVersion: 1\n\nproviders:\n\n  - name: 'cybermaggedon'\n    type: file\n    disableDeletion: false\n    editable: true\n    updateIntervalSeconds: 30\n    allowUiUpdates: false\n    options:\n      path: /var/lib/grafana/dashboards\n\n"
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
                "datasource.yml": "apiVersion: 1\n\ndatasources:\n  - name: Prometheus\n    type: prometheus\n    access: proxy\n    url: http://prometheus:9090\n    basicAuth: false\n    isDefault: true\n    readOnly: false\n\n"
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
                "dashboard.json": "{\n  \"annotations\": {\n    \"list\": [\n      {\n        \"builtIn\": 1,\n        \"datasource\": \"-- Grafana --\",\n        \"enable\": true,\n        \"hide\": true,\n        \"iconColor\": \"rgba(0, 211, 255, 1)\",\n        \"name\": \"Annotations & Alerts\",\n        \"type\": \"dashboard\"\n      }\n    ]\n  },\n  \"editable\": true,\n  \"gnetId\": null,\n  \"graphTooltip\": 0,\n  \"id\": 1,\n  \"links\": [],\n  \"panels\": [\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 7,\n        \"w\": 12,\n        \"x\": 0,\n        \"y\": 0\n      },\n      \"hiddenSeries\": false,\n      \"id\": 14,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"rate(event_total[1m])\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"Events processed\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    },\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 7,\n        \"w\": 12,\n        \"x\": 12,\n        \"y\": 0\n      },\n      \"hiddenSeries\": false,\n      \"id\": 4,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"rate(hits_on_category[1m])\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"Indicators\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    },\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 6,\n        \"w\": 12,\n        \"x\": 0,\n        \"y\": 7\n      },\n      \"hiddenSeries\": false,\n      \"id\": 6,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"rate(cassandra_loaded[1m])\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"Cassandra load\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    },\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 6,\n        \"w\": 12,\n        \"x\": 12,\n        \"y\": 7\n      },\n      \"hiddenSeries\": false,\n      \"id\": 8,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"rate(elasticsearch_succeeded_sum[1m])\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        },\n        {\n          \"expr\": \"rate(elasticsearch_failed_sum[1m])\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"B\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"ElasticSearch load\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    },\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 6,\n        \"w\": 12,\n        \"x\": 0,\n        \"y\": 13\n      },\n      \"hiddenSeries\": false,\n      \"id\": 10,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"pulsar_rate_in\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"Pulsar in\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    },\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 6,\n        \"w\": 12,\n        \"x\": 12,\n        \"y\": 13\n      },\n      \"hiddenSeries\": false,\n      \"id\": 12,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"pulsar_rate_out\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"Pulsar out\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    },\n    {\n      \"aliasColors\": {},\n      \"bars\": false,\n      \"dashLength\": 10,\n      \"dashes\": false,\n      \"datasource\": null,\n      \"fieldConfig\": {\n        \"defaults\": {\n          \"custom\": {}\n        },\n        \"overrides\": []\n      },\n      \"fill\": 1,\n      \"fillGradient\": 0,\n      \"gridPos\": {\n        \"h\": 7,\n        \"w\": 12,\n        \"x\": 0,\n        \"y\": 19\n      },\n      \"hiddenSeries\": false,\n      \"id\": 2,\n      \"legend\": {\n        \"avg\": false,\n        \"current\": false,\n        \"max\": false,\n        \"min\": false,\n        \"show\": true,\n        \"total\": false,\n        \"values\": false\n      },\n      \"lines\": true,\n      \"linewidth\": 1,\n      \"nullPointMode\": \"null\",\n      \"options\": {\n        \"dataLinks\": []\n      },\n      \"percentage\": false,\n      \"pointradius\": 2,\n      \"points\": false,\n      \"renderer\": \"flot\",\n      \"seriesOverrides\": [],\n      \"spaceLength\": 10,\n      \"stack\": false,\n      \"steppedLine\": false,\n      \"targets\": [\n        {\n          \"expr\": \"rate(event_processing_time_sum[1m])\",\n          \"interval\": \"\",\n          \"legendFormat\": \"\",\n          \"refId\": \"A\"\n        }\n      ],\n      \"thresholds\": [],\n      \"timeFrom\": null,\n      \"timeRegions\": [],\n      \"timeShift\": null,\n      \"title\": \"Event latency\",\n      \"tooltip\": {\n        \"shared\": true,\n        \"sort\": 0,\n        \"value_type\": \"individual\"\n      },\n      \"type\": \"graph\",\n      \"xaxis\": {\n        \"buckets\": null,\n        \"mode\": \"time\",\n        \"name\": null,\n        \"show\": true,\n        \"values\": []\n      },\n      \"yaxes\": [\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        },\n        {\n          \"format\": \"short\",\n          \"label\": null,\n          \"logBase\": 1,\n          \"max\": null,\n          \"min\": null,\n          \"show\": true\n        }\n      ],\n      \"yaxis\": {\n        \"align\": false,\n        \"alignLevel\": null\n      }\n    }\n  ],\n  \"schemaVersion\": 25,\n  \"style\": \"dark\",\n  \"tags\": [],\n  \"templating\": {\n    \"list\": []\n  },\n  \"time\": {\n    \"from\": \"now-30m\",\n    \"to\": \"now\"\n  },\n  \"timepicker\": {\n    \"refresh_intervals\": [\n      \"10s\",\n      \"30s\",\n      \"1m\",\n      \"5m\",\n      \"15m\",\n      \"30m\",\n      \"1h\",\n      \"2h\",\n      \"1d\"\n    ]\n  },\n  \"timezone\": \"\",\n  \"title\": \"Metrics\",\n  \"uid\": \"UhSsl6ZGk\",\n  \"version\": 4\n}\n"
            }
        }, {
            provider: provider
        })
    ]
}

