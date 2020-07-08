
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const name = "zookeeper";
const images = ["cybermaggedon/zookeeper:3.6.1"];

const resources = function(config, provider) {

    const zookeepers = config.get("gaffer.zookeeper-nodes") ?
          config.getNumber("gaffer.zookeeper-nodes") : 1;

    const containerPorts = [
        { name: "service", containerPort: 2181 },
        { name: "internal1", containerPort: 2888 },
        { name: "internal2", containerPort: 3888 }
    ];

    const container = function(id) {
        return {
            name: "zookeeper",
            image: images[0],
            env: [
                { name: "ZOOKEEPER_MYID", value: id.toString() },
                { name: "ZOOKEEPERS", value: zookeepers.toString() }
            ],
            ports: containerPorts,
            resources: {
                limits: { cpu: "0.5", memory: "1G" },
                requests: { cpu: "0.05", memory: "1G" },
            },
            volumeMounts: [
                { name: "data", mountPath: "/data" }
            ]
        };
    };

    const deployment = function(id) {
        const instance = "zookeeper" + id.toString();
        return new k8s.apps.v1.Deployment(instance, {
            metadata: {
                name: name,
                namespace: config.require("k8s-namespace"),
                labels: {
                    instance: instance, app: "zookeeper", component: "gaffer"
                },
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: instance, app: "zookeeper",
                        component: "gaffer"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: instance, app: "zookeeper",
                            component: "gaffer"
                        }
                    },
                    spec: {
                        containers: [container],
                        volumes: [
                            {
                                name: "data",
                                persistentVolumeClaim: {
                                    claimName: instance
                                }
                            }
                        ],
                        hostname: instance,
                        subdomain: "zk"
                    }
                }
            }
        }, {
            provider: provider
        });
    };
        
    const deployments = function() {
        var rtn = [];
        for (var i = 0; i < zookeepers; i++) {
            rtn.push(deployment(i));
        }
        return rtn;
    }();

    const storageClass = new k8s.storage.v1.StorageClass("zookeeper", {
        metadata: {
            name: "zookeeper",
            labels: { app: "zookeeper", component: "gaffer" },
        },
        parameters: { type: "pd-ssd" },
        provisioner: "kubernetes.io/gce-pd",
        reclaimPolicy:  "Retain"
    }, {
        provider: provider
    });

    const pvc = function(id) {
        const instance = "zookeeper" + id.toString();
        return new k8s.core.v1.PersistentVolumeClaim(instance, {
            metadata: {
                name: instance,
                namespace: config.require("k8s-namespace"),
                labels: { instance: instance, app: "zookeeper",
                          component: "gaffer" }
            },
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: {
                    requests: { storage: "5G" }
                },
                storageClassName: "zookeeper",
                volumeMode: "Filesystem"
            }
        }, {
            provider: provider
        });
    };

    const pvcs = function() {
        var rtn = [];
        for (var i = 0; i < zookeepers; i++) {
            rtn.push(pvc(i));
        }
        return rtn;
    }();

    const svc = new k8s.core.v1.Service("zookeeper", {
        metadata: {
            name: "zookeeper",
            namespace: config.require("k8s-namespace"),
            labels: { app: "zookeeper", component: "gaffer" }
         },
        spec: {
            ports: [
                { name: "service", port: 2181, targetPort: 2181,
                  protocol: "TCP" },
                { name: "internal1", port: 2888, targetPort: 2888,
                  protocol: "TCP" },
                { name: "internal2", port: 3888, targetPort: 3888,
                  protocol: "TCP" }
            ],
            clusterIP: "None",
            selector: {
                app: "zookeeper",
                component: "gaffer"
            }
         }
    }, {
        provider: provider
    });


    return deployments.
            concat(pvcs).
            concat([storageClass, svc]);

    
};

exports.name = name;
exports.images = images;
exports.resources = resources;

