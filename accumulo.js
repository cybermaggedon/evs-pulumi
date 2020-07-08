
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const name = "accumulo";
const images = ["cybermaggedon/accumulo-gaffer:1.12.0b"];

const resources = function(config, provider) {

    const tabletServers = config.get("gaffer.accumulo-tablet-servers") ?
          config.getNumber("gaffer.accumulo-tablet-servers") : 1;

    const zookeepers = config.get("gaffer.zookeeper-nodes") ?
          config.getNumber("gaffer.zookeeper-nodes") : 1;

    const containerPorts = [
        { name: "master", containerPort: 9999 },
        { name: "tablet-server", containerPort: 9997 },
        { name: "gc", containerPort: 50091 },
        { name: "monitor", containerPort: 9995 },
        { name: "monitor-log", containerPort: 4560 },
        { name: "tracer", containerPort: 12234 },
        { name: "proxy", containerPort: 42424 },
        { name: "slave", containerPort: 10002 },
        { name: "replication", containerPort: 10001 },
    ];

    // Function, returns a Zookeeper list, comma separated list of ZK IDs.
    const zookeeperList = function() {
        var rtn = [];
        for (var i = 0; i < zookeepers; i++) {
            rtn.push("zk" + (i + 1).toString() + ".zookeeper");
        }
        return rtn.join();
    }();

    const zeroPad = (num, places) => String(num).padStart(places, '0')

    // Function, returns a Zookeeper list, comma separated list of ZK IDs.
    const tabletServerList = function() {
        var rtn = [];
        for (var i = 0; i < tabletServers; i++) {
            rtn.push("tserver" + zeroPad(i, 4) + ".accumulo")
        }
        return rtn.join();
    }();

    // Environment variables
    const env = function(id, proc) {
        var rtn = [];

        // List of Zookeepers.
        rtn.push({ name: "ZOOKEEPERS", value: zookeeperList });

        // List of master, gc, monitor, tracer and slave hosts.  This does the
        // thing where MY_IP is used instead of a hostname when the node in
        // question supplies the function.
        rtn.push({ name: "MASTER_HOSTS", value: "master.accumulo" });
        rtn.push({ name: "GC_HOSTS", value: "gc.accumulo" });
        rtn.push({ name: "MONITOR_HOSTS", value: "monitor.accumulo" });
        rtn.push({ name: "TRACER_HOSTS", value: "tracer.accumulo" });

        // Slaves only need to know about the master, don't need to know about
        // all the other slaves.  This is only a deal, because in a big cluster,
        // this would generate a lot of config.
        if (id >= 0) {
            rtn.push({ name: "SLAVE_HOSTS",
                       value: "tablet" + zeroPad(id, 4) + ".accumulo" });
        } else {
            rtn.push({ name: "SLAVE_HOSTS", value: tabletServerList });
        }

        // HDFS references.
        rtn.push({ name: "HDFS_VOLUMES",
                   value: "hdfs://hadoop:9000/accumulo" });
        rtn.push({ name: "NAMENODE_URI",
                   value: "hdfs://hadoop:9000/" });

        // Sizing parameters.
        rtn.push({ name: "MEMORY_MAPS_MAX", value: "300M" });
        rtn.push({ name: "CACHE_DATA_SIZE", value: "30M" });
        rtn.push({ name: "CACHE_INDEX_SIZE", value: "40M" });
        rtn.push({ name: "SORT_BUFFER_SIZE", value: "50M" });
        rtn.push({ name: "WALOG_MAX_SIZE", value: "512M" });

        return rtn;

    };

    const container = function(proc) {
        return {
            name: "accumulo",
            image: images[0],
            ports: containerPorts,
            command: [ "/start-process", proc ],
            env: env(-1, proc),
            resources: {
                limits: { cpu: "0.5", memory: "512M" },
                requests: { cpu: "0.05", memory: "512M" },
            }
        }
    };

    const tabletServerContainer = function(id) {
        return {
            name: "accumulo",
            image: images[0],
            ports: containerPorts,
            command: [ "/start-process", "tserver" ],
            env: env(id, "tserver"),
            resources: {
                limits: { cpu: "1.0", memory: "1G" },
                requests: { cpu: "0.1", memory: "1G" },
            }
        }
    };

    const deployment = function(proc) {
        const instance = "accumulo-" + proc;
        return new k8s.apps.v1.Deployment(instance, {
            metadata: {
                name: instance,
                namespace: config.require("k8s-namespace"),
                labels: {
                    instance: instance, app: "accumulo", component: "gaffer"
                },
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: instance, app: "accumulo",
                        component: "gaffer"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: instance, app: "accumulo",
                            component: "gaffer"
                        }
                    },
                    spec: {
                        containers: [ container(proc) ],
                    },
                    hostname: proc,
                    subdomain: "accumulo"
                }
            }
        }, {
            provider: provider
        });
    };
          
    const tabletServerDeployment = function(id) {
        const instance = "accumulo-ts-" + zeroPad(id, 4);
        return new k8s.apps.v1.Deployment(instance, {
            metadata: {
                name: instance,
                namespace: config.require("k8s-namespace"),
                labels: {
                    instance: instance, app: "accumulo", component: "gaffer"
                },
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        instance: instance, app: "accumulo",
                        component: "gaffer"
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            instance: instance, app: "accumulo",
                            component: "gaffer"
                        }
                    },
                    spec: {
                        containers: [ tabletServerContainer(id) ],
                    },
                    hostname: "tserver" + zeroPad(id, 4),
                    subdomain: "accumulo"
                }
            }
        }, {
            provider: provider
        });
    };

    const deployments = function() {
        var rtn = [];

        // Deployments for master, gc, tracer, monitor.
        rtn.push(deployment("master"));
        rtn.push(deployment("gc"));
        rtn.push(deployment("tracer"));
        rtn.push(deployment("monitor"));

        for (var i = 0; i < tabletServers; i++) {
            rtn.push(tabletServerDeployment(i));
        }

        return rtn;
    }();

    const svc = new k8s.core.v1.Service("accumulo", {
        metadata: {
            name: "accumulo",
            namespace: config.require("k8s-namespace"),
            labels: { app: "accumulo", component: "gaffer" }
         },
        spec: {
            ports: [
                { name: "master", port: 9999, targetPort: 9999,
                  protocol: "TCP" },
                { name: "gc", port: 50091, targetPort: 50091,
                  protocol: "TCP" },
                { name: "monitor", port: 9995, targetPort: 9995,
                  protocol: "TCP" },
                { name: "tracer", port: 12234, targetPort: 12234,
                  protocol: "TCP" },
                { name: "proxy", port: 42424, targetPort: 42424,
                  protocol: "TCP" },
                { name: "slave", port: 10002, targetPort: 10002,
                  protocol: "TCP" },
                { name: "replication", port: 10001, targetPort: 10001,
                  protocol: "TCP" }
            ],
            clusterIP: "None",
            selector: {
                instance: "accumulo-master",
                app: "accumulo",
                component: "gaffer"
            }
         }
    }, {
        provider: provider
    });

    return deployments.concat([svc]);
    
};

exports.name = name;
exports.images = images;
exports.resources = resources;
