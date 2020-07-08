
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const name = "hadoop";
const images = ["cybermaggedon/hadoop:2.10.0"];

const resources = function(config, provider) {

    const replication = config.get("gaffer.hadoop-replication") ?
          config.getNumber("gaffer.hadoop-replication") : 1;

    const hadoops = config.get("gaffer.hadoop-datanodes") ?
          config.getNumber("gaffer.hadoop-datanodes") : 1;

    const containerPorts = [
        { name: "namenode-http", containerPort: 50070 },
        { name: "datanode", containerPort: 50075 },
        { name: "namenode-rpc", containerPort: 9000 }
    ];

    const namenodeContainers = [
        {
            name: "hadoop",
            image: images[0],
            env: [
                { name: "DFS_REPLICATION", value: replication.toString() },
                { name: "DAEMONS", value: "namenode" }
            ],
            ports: containerPorts,
            resources: {
                limits: { cpu: "1.0", memory: "1G" },
                requests: { cpu: "0.1", memory: "1G" },
            },
            volumeMounts: [
                { name: "data", mountPath: "/data" }
            ]
        }
    ];

    const namenodeDepl = new k8s.apps.v1.Deployment("hadoop-namenode", {
        metadata: {
            name: name,
            namespace: config.require("k8s-namespace"),
            labels: {
                instance: "hadoop-namenode", app: "hadoop", component: "gaffer"
            },
        },
        spec: {
            replicas: 1,
            selector: {
                matchLabels: {
                    instance: "hadoop-namenode", app: "hadoop",
                    component: "gaffer"
                }
            },
            template: {
                metadata: {
                    labels: {
                        instance: "hadoop-namenode", app: "hadoop",
                        component: "gaffer"
                    }
                },
                spec: {
                    containers: namenodeContainers,
                    volumes: [
                        {
                            name: "data",
                            persistentVolumeClaim: {
                                claimName: "hadoop-namenode"
                            }
                        }
                    ],
                    hostname: "namenode",
                    subdomain: "hadoop"
                }
            }
        }
    }, {
        provider: provider
    });

    const datanodeContainers = [
        {
            name: "hadoop",
            image: images[0],
            env: [
                { name: "NAMENODE_URI", value: "hdfs://hadoop:9000" },
                { name: "DAEMONS", value: "datanode" }
            ],
            ports: containerPorts,
            resources: {
                limits: { cpu: "1.0", memory: "1G" },
                requests: { cpu: "0.1", memory: "1G" },
            },
            volumeMounts: [
                { name: "data", mountPath: "/data" }
            ]
        }
    ];

    const zeroPad = (num, places) => String(num).padStart(places, '0')

    const datanodeDepl = function(id) {
        const count = zeroPad(id, 4);
        const instance = name + "-data-" + count;
        return new k8s.apps.v1.Deployment(instance, {
            metadata: {
                name: instance,
                namespace: config.require("k8s-namespace"),
                labels: {
                    instance: instance, app: "hadoop",
                    component: "gaffer"
                },
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: instance, app: "hadoop",
                        component: "gaffer"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: instance, app: "hadoop",
                            component: "gaffer"
                        }
                    },
                    spec: {
                        containers: datanodeContainers,
                        volumes: [
                            {
                                name: "data",
                                persistentVolumeClaim: {
                                    claimName: instance
                                }
                            }
                        ],
                        hostname: "data-" + count,
                        subdomain: "hadoop"
                    }
                }
            }
        }, {
            provider: provider
        })
    };

    const datanodeDepls = function() {
        var rtn = [];
        for (var i = 0; i < hadoops; i++) {
            rtn.push(datanodeDepl(i));
        }
        return rtn;
    }();

    const storageClass = new k8s.storage.v1.StorageClass("hadoop", {
        metadata: {
            name: "hadoop",
            labels: { app: "hadoop", component: "gaffer" },
        },
        parameters: { type: "pd-ssd" },
        provisioner: "kubernetes.io/gce-pd",
        reclaimPolicy:  "Retain"
    }, {
        provider: provider
    });

    const pvc = function(name, size) {
        return new k8s.core.v1.PersistentVolumeClaim(name, {
            metadata: {
                name: name,
                namespace: config.require("k8s-namespace"),
                labels: { instance: name, app: "hadoop",
                          component: "gaffer" }
            },
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: {
                    requests: { storage: size }
                },
                storageClassName: "hadoop",
                volumeMode: "Filesystem"
            }
        }, {
            provider: provider
        });
    }
    
    const pvcs = function() {
        var rtn = [];
        rtn.push(pvc("hadoop-namenode", "5G"));
        for (var id = 0; id < hadoops; id++) {
            const count = zeroPad(id, 4);
            const instance = name + "-data-" + count;
            rtn.push(pvc(instance, "5G"));
        }
        return rtn;
    }();

    const svc = new k8s.core.v1.Service("hadoop", {
        metadata: {
            name: "hadoop",
            namespace: config.require("k8s-namespace"),
            labels: { app: "hadoop", component: "gaffer" }
         },
        spec: {
            ports: [
                { name: "rpc", port: 9000, targetPort: 9000, protocol: "TCP" },
                { name: "http", port: 50070, targetPort: 50070,
                  prototol: "TCP" }
            ],
            selector: {
                instance: "hadoop-namenode",
                app: "hadoop",
                component: "gaffer"
            }
         }
    }, {
        provider: provider
    });


    return [ namenodeDepl ].
        concat(datanodeDepl).
        concat(pvcs).
        concat([storageClass, svc]);

    
};

exports.name = name;
exports.images = images;
exports.resources = resources;

