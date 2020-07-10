
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {

    const authRealmName = config.get("auth-realm-name") ?
          config.get("auth-realm-name") : "cyberapocalypse";

    const authClientId = config.get("auth-client-id") ?
          config.get("auth-client-id") : "evs";

    const callbackUrl = "https://" + config.require("portal-host") +
          "/auth/auth";

    const authUrl = "https://" + config.require("accounts-host") +
          "/auth/realms/" + authRealmName + "/protocol/openid-connect/auth";

    const tokenUrl = "http://keycloak:8080/auth/realms/" + authRealmName +
          "/protocol/openid-connect/token";

    const userInfoUrl = "http://keycloak:8080/auth/realms/" + authRealmName +
          "/protocol/openid-connect/userinfo";

    const scopes = "openid,email,profile";

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
                                        value: config.require("auth-domain")
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
                                        value: authClientId
                                    },
                                    {
                                        // Not using a client secret.
                                        // Public form, tied down to a
                                        // redirect URI.
                                        name: "OAUTH_CLIENT_SECRET",
                                        value: "not-used"
                                    },
                                    {
                                        name: "OAUTH_CALLBACK_URL",
                                        value: callbackUrl
                                    },
                                    {
                                        name: "OAUTH_AUTH_URL",
                                        value: authUrl
                                    },
                                    {
                                        name: "OAUTH_TOKEN_URL",
                                        value: tokenUrl
                                    },
                                    {
                                        name: "OAUTH_USER_INFO_URL",
                                        value: userInfoUrl
                                    },
                                    {
                                        name: "OAUTH_SCOPES",
                                        value: scopes
                                    },
                                    {
                                        name: "VOUCH_JWT_SECRET",
                                        valueFrom: {
                                            secretKeyRef: {
                                                name: "jwt-secret",
                                                key: "secret"
                                            }
                                        }

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

        new k8s.core.v1.Secret("jwt-secret", {
            metadata: {
                name: "jwt-secret",
                namespace: config.require("k8s-namespace")
            },
            stringData: {
                "secret": config.requireSecret("jwt-secret")
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

