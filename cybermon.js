
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

exports.resources = function(config, provider) {
    return [
        new k8s.apps.v1.Deployment("cybermon", {
            "metadata": {
                "labels": {
                    "app": "cybermon",
                    "component": "cybermon",
                    "instance": "cybermon"
                },
                "name": "cybermon",
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "replicas": 1,
                "selector": {
                    "matchLabels": {
                        "app": "cybermon",
                        "component": "cybermon",
                        "instance": "cybermon"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "app": "cybermon",
                            "component": "cybermon",
                            "instance": "cybermon"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "command": [
                                    "cybermon",
                                    "-p",
                                    "9000",
                                    "-c",
                                    "/usr/local/share/cyberprobe/protostream.lua"
                                ],
                                "env": [
                                    {
                                        "name": "PULSAR_BROKER",
                                        "value": "ws://exchange:8080"
                                    }
                                ],
                                "image": "docker.io/cybermaggedon/cyberprobe:2.5.1",
                                "name": "cybermon",
                                "ports": [
                                    {
                                        "containerPort": 9000,
                                        "name": "etsi"
                                    },
                                    {
                                        "containerPort": 8088,
                                        "name": "metrics"
                                    }
                                ],
                                "resources": {
                                    "limits": {
                                        "cpu": "1.0",
                                        "memory": "256M"
                                    },
                                    "requests": {
                                        "cpu": "0.1",
                                        "memory": "256M"
                                    }
                                },
                                "volumeMounts": [
                                    {
                                        "mountPath": "/usr/local/share/cyberprobe",
                                        "name": "config",
                                        "readOnly": false
                                    }
                                ]
                            },
                            {
                                "image": "docker.io/cybermaggedon/evs-input:0.4.2",
                                "name": "evs-input",
                                "resources": {
                                    "limits": {
                                        "cpu": "1.0",
                                        "memory": "128M"
                                    },
                                    "requests": {
                                        "cpu": "0.1",
                                        "memory": "128M"
                                    }
                                }
                            }
                        ],
                        "volumes": [
                            {
                                "configMap": {
                                    "name": "cybermon-config"
                                },
                                "name": "config"
                            }
                        ]
                    }
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.Service("cybermon", {
            "metadata": {
                "labels": {
                    "app": "cybermon",
                    "component": "cybermon"
                },
                "name": "cybermon",
                "namespace": config.require("k8s-namespace")
            },
            "spec": {
                "ports": [
                    {
                        "name": "etsi",
                        "port": 9000,
                        "protocol": "TCP",
                        "targetPort": 9000
                    },
                    {
                        "name": "metrics",
                        "port": 8088,
                        "protocol": "TCP",
                        "targetPort": 8088
                    }
                ],
                "selector": {
                    "app": "cybermon",
                    "component": "cybermon"
                }
            }
        }, {
            provider: provider
        }),
        new k8s.core.v1.ConfigMap("cybermon-config", {
            "metadata": {
                "labels": {
                    "app": "cybermon",
                    "component": "cybermon"
                },
                "name": "cybermon-config",
                "namespace": config.require("k8s-namespace")
            },
            "data": {
                "protostream.lua": "-- Outputs events as PDUs in a stream.  PDUs are protobuf enoded, and have\n-- a 4-byte length header.\nlocal observer = {}\n\n-- Other modules -----------------------------------------------------------\nlocal os = require(\"os\")\nlocal json = require(\"json\")\nlocal string = require(\"string\")\nlocal socket = require(\"socket\")\nlocal mime = require(\"mime\")\n\n-- Config ------------------------------------------------------------------\n\nlocal default_host = \"localhost\"\nif os.getenv(\"STREAM_HOST\") then\n  host = os.getenv(\"STREAM_HOST\")\nelse\n  host = default_host\nend\n\nlocal default_port = 6789\nif os.getenv(\"STREAM_PORT\") then\n  port = tonumber(os.getenv(\"STREAM_PORT\"))\nelse\n  port = default_port\nend\n\nprint(\"Host:\" .. host)\nprint(\"Port:\" .. port)\n\nlocal init = function()\n  sender = socket.tcp()\n  a = sender:connect(host, port)\n  print(\"Connected.\")\nend\n\n-- Object submission function - just pushes the object onto the queue.\nlocal submit = function(data)\n\n  len = string.len(data)\n\n  lenb = string.char((len >> 24) & 255, (len >> 16) & 255, (len >> 8) & 255,\n    len & 255)\n\n  pdu = lenb .. data\n\n  while true do\n\n    a = sender:send(pdu)\n    if a ~= nil then\n      break\n    end\n\n    print(\"Socket delivery failed, will reconnect.\")\n    socket.select(nil, nil, 1)\n    init()\n\n  end\n\nend\n\nobserver.event = function(e)\n  submit(e:protobuf())\nend\n\n-- Initialise\ninit()\n\n-- Return the table\nreturn observer\n\n"
            }
        }, {
            provider: provider
        })
    ];

}
