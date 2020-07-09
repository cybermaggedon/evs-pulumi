
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {
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
                "loadBalancerIP": "1.2.3.4",
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
                "default.conf": "\nserver {\n    listen 443 ssl;\n    server_name portal.portal.cyberapocalypse.co.uk;\n\n    ssl_certificate /etc/tls/portal/server.crt;\n    ssl_certificate_key /etc/tls/portal/server.key;\n\n    # https://github.com/vouch/vouch-proxy\n    # send all requests to the `/validate` endpoint for authorization\n    location = /validate {\n\n        # /validate proxies all the requests to lasso\n        # lasso can also run behind the same nginx-revproxy\n        proxy_pass https://portal.portal.cyberapocalypse.co.uk/auth/validate;\n\n        # lasso only acts on the request headers\n        proxy_pass_request_body off;\n        proxy_set_header Content-Length \"\";\n        # valid user!\n        # add X-Vouch-User to the request\n        auth_request_set $auth_resp_x_vouch_user $upstream_http_x_vouch_user;\n\n        # these return values are used by the @error401 call\n        auth_request_set $auth_resp_jwt $upstream_http_x_vouch_jwt;\n        auth_request_set $auth_resp_err $upstream_http_x_vouch_err;\n        auth_request_set $auth_resp_failcount $upstream_http_x_vouch_failcount;\n    }\n\n    # if validate returns `401 not authorized` then forward the request to the error401block\n    error_page 401 = @error401;\n\n    location @error401 {\n        # redirect to vouch proxy for login\n        return 302 https://portal.portal.cyberapocalypse.co.uk/auth/login?url=$scheme://$http_host$request_uri&lasso-failcount=$auth_resp_failcount&X-Vouch-Token=$auth_resp_jwt&error=$auth_resp_err;\n    }\n\n    location /auth/ {\n        proxy_pass http://vouch:9090/;\n        # be sure to pass the original host header\n        proxy_set_header Host $http_host;\n    }\n\n    location /grafana/ {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        proxy_pass http://grafana:3000/;\n    }\n\n    location /prometheus/ {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        proxy_pass http://prometheus:9090/;\n    }\n\n    location /risk-graph/ {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        proxy_pass http://risk-graph:8080/;\n    }\n\n    location /threat-graph/ {\n        proxy_pass http://threat-graph:8080/;\n    }\n\n    location /kibana/ {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        proxy_pass http://kibana:5601/;\n    }\n\n    location /elasticsearch/ {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        proxy_pass http://elasticsearch:9200/;\n    }\n\n    location /pulsar-manager/ {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        proxy_pass http://pulsar-manager:9527/;\n    }\n\n    location / {\n        auth_request /validate;\n        auth_request_set $auth_user $upstream_http_x_vouch_user;\n        proxy_set_header Remote-User $auth_user;\n        root   /usr/share/nginx/html;\n        index  index.html index.htm;\n    }\n\n    #error_page  404              /404.html;\n\n    # redirect server error pages to the static page /50x.html\n    #\n    error_page   500 502 503 504  /50x.html;\n    location = /50x.html {\n        root   /usr/share/nginx/html;\n    }\n\n}\n\nserver {\n\n    listen 443 ssl;\n    server_name accounts.portal.cyberapocalypse.co.uk;\n\n    ssl_certificate /etc/tls/portal/server.crt;\n    ssl_certificate_key /etc/tls/portal/server.key;\n\n    location / {\n        proxy_pass http://keycloak:8080/;\n        proxy_set_header Host $http_host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n\n}\n\n"
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
                "50x.html": "<!DOCTYPE html>\n<html>\n<head>\n<title>Error</title>\n<style>\n    body {\n        width: 35em;\n        margin: 0 auto;\n        font-family: Tahoma, Verdana, Arial, sans-serif;\n    }\n</style>\n</head>\n<body>\n<h1>An error occurred.</h1>\n<p>Sorry, the page you are looking for is currently unavailable.<br/>\nPlease try again later.</p>\n<p>If you are the system administrator of this resource then you should check\nthe error log for details.</p>\n</body>\n</html>\n",
                "index.html": "<!DOCTYPE html>\n<html>\n\n  <body>\n\n\n    <ul>\n      <li><a href=\"/grafana/d/UhSsl6ZGk/metrics\">Metrics</a></li>\n      <li><a href=\"/kibana\">Kibana</a></li>\n      <li><a href=\"/prometheus\">Prometheus</a></li>\n    </ul>\n\n  </body>\n  \n</script>\n\n\n</html>\n"
            }
        }, {
            provider: provider
        })
    ];
}

