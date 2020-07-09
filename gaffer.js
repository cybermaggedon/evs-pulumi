
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const fs = require('fs');

const name = "gaffer";
const images = ["cybermaggedon/wildfly-gaffer:1.12.0b"];

const gaffer = function(config, provider, required, id, schema, table) {

    const zookeepers = config.get("gaffer.zookeeper-nodes") ?
          config.getNumber("gaffer.zookeeper-nodes") : 1;

    // Function, returns a Zookeeper list, comma separated list of ZK IDs.
    const zookeeperList = function() {
        var rtn = [];
        for (var i = 0; i < zookeepers; i++) {
            rtn.push("zk" + (i + 1).toString() + ".zookeeper");
        }
        return rtn.join();
    }();

    const containerPorts = [
        { name: "rest", containerPort: 8080 }
    ];

    // Environment variables
    const env = [
        { name: "ZOOKEEPERS", value: zookeeperList },
        { name: "ACCUMULO_TABLE", value: table }
    ];

    const configMaps = function() {
        const gaffer = "gaffer-" + id;
        return [
            new k8s.core.v1.ConfigMap(gaffer, {
                metadata: {
                    name: id + "-schema",
                    labels: { app: gaffer, component: "gaffer" },
                    namespace: config.require("k8s-namespace")
                },
                data: {
                    "schema.json": schema
                }
            }, {
                provider: provider
            })
        ];
    }();

    const volumes = [
        { name: "schema", configMap: { name: id + "-schema" } }
    ];

    const container = {
        name: "gaffer",
        image: images[0],
        ports: containerPorts,
        env: env,
        resources: {
            limits: { cpu: "1.0", memory: "1G" },
            requests: { cpu: "0.1", memory: "1G" },
        },
        volumeMounts: [
            { name: "schema", mountPath: "/usr/local/wildfly/schema",
              readOnly: true }
        ]
    };

    const deployment = function() {
        const instance = "gaffer-" + id;
        return new k8s.apps.v1.Deployment(instance, {
            metadata: {
                name: instance,
                namespace: config.require("k8s-namespace"),
                labels: {
                    instance: instance, app: "gaffer", component: "gaffer"
                },
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: instance, app: "gaffer", component: "gaffer"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: instance, app: "gaffer",
                            component: "gaffer"
                        }
                    },
                    spec: {
                        containers: [ container ],
                        volumes: volumes,
                    },
                }
            }
        }, {
            provider: provider,
            dependsOn: required
        });
    }();

    const svc = new k8s.core.v1.Service(id + "-graph", {
        metadata: {
            name: id + "-graph",
            namespace: config.require("k8s-namespace"),
            labels: { app: "gaffer", component: "gaffer" }
         },
        spec: {
            ports: [
                { name: "rest", port: 8080, targetPort: 8080,
                  protocol: "TCP" }
            ],
            selector: {
                instance: "gaffer-" + id,
                app: "gaffer",
                component: "gaffer"
            }
         }
    }, {
        provider: provider,
        dependsOn: required
    });

    return configMaps.concat([deployment, svc]);
    
};

exports.name = name;
exports.images = images;
exports.resources = function(config, provider, required) {

    var threatSchema = fs.readFileSync("threatgraph-schema.json", "utf-8");
    var riskSchema = fs.readFileSync("riskgraph-schema.json", "utf-8");

    return [].
        concat(gaffer(config, provider, required, "risk", riskSchema,
                      "riskgraph")).
        concat(gaffer(config, provider, required,  "threat", threatSchema,
                      "threatgraph"))
}
    
