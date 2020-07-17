
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const analytics = [
  {n: "evs-geoip", v: "0.4.2", e: []},
  {n: "evs-detector", v: "0.4.2", e: []},
  {n: "evs-elasticsearch", v: "0.4.4", e: [
      {name: "ELASTICSEARCH_URL", value:"http://elasticsearch:9200"}
  ]},
  {n: "evs-threatgraph", v: "0.4.4", e: [
      {name:"GAFFER_URL", value:"http://threat-graph:8080/rest/v2"}
  ]},
  {n: "evs-riskgraph", v: "0.4.2", e: [
      {name:"GAFFER_URL", value:"http://risk-graph:8080/rest/v2"}
  ]},
  {n: "evs-cassandra", v: "0.4.2", e: [
      {name:"CASSANDRA_CLUSTER", value:"cassandra"}
  ]}
];

exports.resources = function(config, provider, required) {
    var rtn = [];

    for (i in analytics) {

        const a = analytics[i];

        var image = "docker.io/cybermaggedon/" + a.n + ":" + a.v;

        var env = a.e;
        env.push( { name: "PULSAR_BROKER", value: "pulsar://exchange:6650" } );

        var depl = new k8s.apps.v1.Deployment(a.n, {
            metadata: {
                name: a.n,
                labels: {
                    instance: a.n, app: a.n, component: "analytics"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: a.n, app: a.n, component: "analytics"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: a.n, app: a.n, component: "analytics"
                        }
                    },
                    spec: {
                        containers: [
                            {
                                name: a.n,
                                image: image,
                                env: env,
                                ports: [
                                    {
                                        containerPort: 8088,
                                        name: "metrics"
                                    }
                                ],
                                resources: {
                                    limits: {
                                        cpu: "1.0", memory: "128M"
                                    },
                                    requests: {
                                        cpu: "0.05", memory: "128M"
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider,
            dependsOn: required
        });

        var svc = new k8s.core.v1.Service(a.n, {
            metadata: {
                name: a.n,
                labels: {
                    app: a.n, component: "analytics"
                },
                namespace: config.require("k8s-namespace")
            },
            spec: {
                ports: [
                    {
                        name: "metrics", port: 8088, targetPort: 8088,
                        protocol: "TCP"
                    }
                ],
                selector: {
                    instance: a.n,
                    app: a.n,
                    component: "analytics"
                }
            }
        }, {
            provider: provider,
            dependsOn: required
        });

        rtn.push(depl);
        rtn.push(svc);

    }

    return rtn;

}

