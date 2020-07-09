
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {
    return [
        new k8s.apps.v1.Deployment("vouch", {
            metadata: {
                name: "vouch",
                labels: {
                    app: "vouch",
                    component: "vouch",
                    instance: "vouch"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: "vouch",
                        app: "vouch",
                        component: "vouch"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: "vouch",
                            app: "vouch",
                            component: "vouch"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                env: [
                                    {
                                        name: "VOUCH_PORT",
                                        value: "9090"
                                    },
                                    {
                                        name: "VOUCH_LISTEN",
                                        value: "0.0.0.0"
                                    },
                                    {
                                        name: "VOUCH_COOKIE_DOMAIN",
                                        value: config.require("domain")
                                    },
                                    {
                                        name: "VOUCH_ALLOWALLUSERS",
                                        value: "true"
                                    },
                                    {
                                        name: "OAUTH_PROVIDER",
                                        value: "oidc"
                                    },
                                    {
                                        name: "OAUTH_CLIENT_ID",
                                        value: "cyberapocalypse"
                                    },
                                    {
                                        name: "OAUTH_CLIENT_SECRET",
                                        value: "NOT_USER"
                                    },
                                    {
                                        name: "OAUTH_CALLBACK_URL",
                                        value: "https://" + config.require("portal-host") + "/auth/auth"
                                    },
                                    {
                                        name: "OAUTH_AUTH_URL",
                                        value: "https://" + config.require("accounts-host") + "/auth/realms/cyberapocalypse/protocol/openid-connect/auth"
                                    },
                                    {
                                        name: "OAUTH_TOKEN_URL",
                                        value: "http://keycloak:8080/auth/realms/cyberapocalypse/protocol/openid-connect/token"
                                    },
                                    {
                                        name: "OAUTH_USER_INFO_URL",
                                        value: "http://keycloak:8080/auth/realms/cyberapocalypse/protocol/openid-connect/userinfo"
                                    },
                                    {
                                        name: "OAUTH_SCOPES",
                                        value: "openid,email,profile"
                                    },
                                    {
                                        name: "VOUCH_JWT_SECRET",
                                        // FIXME: Use k8s secret
                                        value: config.require("jwt-secret")
                                    }
                                ],
                                image: "voucher/vouch-proxy:0.16.2",
                                name: "vouch",
                                ports: [
                                    {
                                        containerPort: 9090,
                                        name: "http"
                                    }
                                ],
                                resources: {
                                    limits: {
                                        cpu: "1.0",
                                        memory: "256M"
                                    },
                                    requests: {
                                        cpu: "0.05",
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
        new k8s.core.v1.Service("vouch", {
            metadata: {
                labels: {
                    app: "vouch",
                    component: "vouch"
                },
                name: "vouch",
                namespace: config.require("k8s-namespace")
            },
            spec: {
                ports: [
                    {
                        name: "http",
                        port: 9090,
                        protocol: "TCP",
                        targetPort: 9090
                    }
                ],
                selector: {
                    app: "vouch",
                    component: "vouch"
                }
            }
        }, {
            provider: provider
        })
    ];

};

