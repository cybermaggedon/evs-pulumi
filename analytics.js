
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require("fs");
const indicators = fs.readFileSync("indicators/indicators.json", "utf-8");

const analytics = [
  {n: "evs-geoip", v: "0.4.2", e: []},
    {n: "evs-detector", v: "0.4.2", e: [
	{ name: "INDICATORS",
	  value: "/usr/local/share/indicators/indicators.json" }
    ]},
  {n: "evs-elasticsearch", v: "0.4.4", e: [
      { name: "ELASTICSEARCH_URL", value: "http://elasticsearch:9200"}
  ]},
  {n: "evs-threatgraph", v: "0.4.4", e: [
      {name:"GAFFER_URL", value: "http://threat-graph:8080/rest/v2"}
  ]},
  {n: "evs-riskgraph", v: "0.4.2", e: [
      {name:"GAFFER_URL", value: "http://risk-graph:8080/rest/v2"}
  ]},
  {n: "evs-cassandra", v: "0.4.2", e: [
      {name:"CASSANDRA_CLUSTER", value: "cassandra"}
  ]}
];

const deployment = function(config, provider, required, name, image, env) {

    var def = {
        metadata: {
            name: name,
            labels: {
                instance: name, app: name, component: "analytics"
            },
            namespace: config.require("k8s-namespace")
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    instance: name, app: name, component: "analytics"
                }
            },
            template: {
                metadata: {
                    labels: {
                        instance: name, app: name, component: "analytics"
                    }
                },
                spec: {
                    containers: [
                        {
                            name: name,
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
    };

    if (name == "evs-detector") {
	def.spec.template.spec.volumes = [
	    {
		configMap: {
		    name: "indicators"
		},
		name: "indicators"
	    }
	];
	def.spec.template.spec.containers[0].volumeMounts = [
	    {
                mountPath: "/usr/local/share/indicators/",
                name: "indicators",
                readOnly: true
            }
	];
    }
    
    return new k8s.apps.v1.Deployment(name, def, {
        provider: provider,
        dependsOn: required
    });

};

const service = function(config, provider, required, name) {

    var svc = new k8s.core.v1.Service(name, {
        metadata: {
            name: name,
            labels: {
                app: name, component: "analytics"
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
                instance: name,
                app: name,
                component: "analytics"
            }
        }
    }, {
        provider: provider,
        dependsOn: required
    });

};

exports.resources = function(config, provider, required) {
    var rtn = [];

    for (i in analytics) {

        const a = analytics[i];

        var image = "docker.io/cybermaggedon/" + a.n + ":" + a.v;

        var env = a.e;
        env.push( { name: "PULSAR_BROKER", value: "pulsar://exchange:6650" } );

        var depl = deployment(config, provider, required, a.n, image, env);

        var svc = service(config, provider, required, a.n);

        rtn.push(depl);
        rtn.push(svc);

    }

    const cm = new k8s.core.v1.ConfigMap("indicators", {
        metadata: {
            name: "indicators",
                labels: {
                    app: "evs-detector",
                    component: "evs-detector"
                },
            namespace: config.require("k8s-namespace")
        },
        data: {
            "indicators.json": indicators
        }
    }, {
        provider: provider
    })

    rtn.push(cm);

    return rtn;

}

