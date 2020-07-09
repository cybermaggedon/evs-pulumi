
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const name = "kibana";
const images = ["kibana:7.7.1"];

const resources = function(config, provider) {

    const containerPorts = [
        { name: "kibana", containerPort: 5601 }
    ];

    const env = [
        { name: "ELASTICSEARCH_URL", value: "http://elasticsearch:9200/" },
        { name: "SERVER_BASEPATH", value: "/kibana" },
        { name: "NODE_OPTIONS", value: "--max_old_space_size=300" }
    ]

    const containers = [
        {
            name: "kibana",
            image: images[0],
            env: env,
            ports: containerPorts,
            resources: {
                limits: { cpu: "1.0", memory: "512M" },
                requests: { cpu: "0.1", memory: "512M" },
            }
        }
    ];

    const deployment = new k8s.apps.v1.Deployment("kibana", {
        metadata: {
            name: name,
            namespace: config.require("k8s-namespace"),
            labels: {
                instance: "kibana", app: "kibana",
                component: "kibana"
            },
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    instance: "kibana", app: "kibana",
                    component: "kibana"
                }
            },
            template: {
                metadata: {
                    labels: {
                        instance: "kibana", app: "kibana",
                        component: "kibana"
                    }
                },
                spec: {
                    containers: containers,
                }
            }
        }
    }, {
        provider: provider
    });

    const svc =
          new k8s.core.v1.Service("kibana", {
              metadata: {
                  name: "kibana",
                  namespace: config.require("k8s-namespace"),
                  labels: { app: "kibana", component: "kibana" }
              },
              spec: {
                  ports: [
                      { name: "kibana", port: 5601, targetPort: 5601,
                        protocol: "TCP" }
                  ],
                  selector: {
                      instance: "kibana",
                      app: "kibana",
                      component: "kibana"
                  }
              }
          }, {
              provider: provider
          });

    return [ deployment, svc ];
    
};

exports.name = name;
exports.images = images;
exports.resources = resources;

