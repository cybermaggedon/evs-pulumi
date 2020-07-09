
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

exports.resources = function(config, provider, ipAddress) {

    const nginx_conf = fs.readFileSync("nginx.conf", "utf-8").
          replace(/%PORTAL_HOST%/g, config.require("portal-host")).
          replace(/%ACCOUNTS_HOST%/g, config.require("accounts-host"));
                          
    return [
        new k8s.apps.v1.Deployment("nginx", {
            "metadata": {
                "name": "nginx",
                "labels": {
                    "instance": "nginx",
                    "app": "nginx",
                    "component": "nginx"
                },
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "replicas": 1,
                "selector": {
                    "matchLabels": {
                        "instance": "nginx",
                        "app": "nginx",
                        "component": "nginx"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "instance": "nginx",
                            "app": "nginx",
                            "component": "nginx"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "name": "nginx",
                                "image": "nginx:1.19.0",
                                "ports": [
                                    {
                                        "containerPort": 443,
                                        "name": "https"
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
                                        "mountPath": "/etc/nginx/conf.d/",
                                        "name": "config",
                                        "readOnly": true
                                    },
                                    {
                                        "mountPath": "/etc/tls/portal/",
                                        "name": "portal-keys",
                                        "readOnly": true
                                    },
                                    {
                                        "mountPath": "/usr/share/nginx/html/",
                                        "name": "pages",
                                        "readOnly": true
                                    }
                                ]
                            }
                        ],
                        "volumes": [
                            {
                                "configMap": {
                                    "name": "nginx-config"
                                },
                                "name": "config"
                            },
                            {
                                "name": "portal-keys",
                                "secret": {
                                    "secretName": "portal-keys"
                                }
                            },
                            {
                                "configMap": {
                                    "name": "web-pages"
                                },
                                "name": "pages"
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("portal", {
            "metadata": {
                "name": "portal",
                "labels": {
                    "app": "nginx",
                    "component": "nginx"
                },
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "loadBalancerIP": ipAddress.address,
                "ports": [
                    {
                        "name": "https",
                        "port": 443,
                        "protocol": "TCP",
                        "targetPort": 443
                    }
                ],
                "selector": {
                    "app": "nginx",
                    "component": "nginx"
                },
                "type": "LoadBalancer"
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("nginx-config", {
            metadata: {
                name: "nginx-config",
                labels: {
                    app: "nginx",
                    component: "nginx"
                },
                namespace: config.require("k8s-namespace")
            },
            data: {
                "default.conf": nginx_conf
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("web-pages", {
            metadata: {
                name: "web-pages",
                labels: {
                    app: "nginx",
                    component: "nginx"
                },
                namespace: config.require("k8s-namespace")
            },
            "data": {
                "50x.html": fs.readFileSync("50x.html", "utf-8"),
                "index.html": fs.readFileSync("index.html", "utf-8")

            }
        }, {
            provider: provider
        })
    ];
}

