
# Event stream cluster

## Description

Deploys a cybermon, receiver on port 9000.  This forwards network events to
Gaffer graph database, Cassandra event store and ElasticSearch/Kibana.

Deploys on Google cloud.

## Deployment

### You will need...

Set up a Google Cloud project, and make sure the Kubernetes and Compute engine
APIs are enabled.

Login using `gcloud init`.

You will also need a working DNS to update settings in.  There needs to be
a DNS zone defined in Google Cloud which we can write new records to.

I did this by setting up my-domain.co.uk on some random DNS service.
Then creating portal.my-domain.co.uk on Google Cloud, and creating a
subdomain entry for portal on random DNS service for the Google domain.

### Install

- Install Pulumi
- `npm install`
- `pulumi login --local`

### Define stack
  
```
  git clone https://github.com/cybermaggedon/evs-pulumi
  cd evs-pulumi

  # Just an identifier to make things unique if you deploy more than one.
  socid=<MY-DOMAIN>

  # Base DNS domain
  domain=<MY-DOMAIN>
  pulumi stack init ${socid}

  # Google project ID
  pulumi config set gcp:project <GOOGLE-PROJECT>
  pulumi config set soc-id ${socid}

  # Region / zoneto deploy to
  pulumi config set region us-east1
  pulumi config set zone us-east1-d

  # Initial k8s deploy node/count.
  pulumi config set node-type n1-standard-2
  pulumi config set initial-node-count 3

  # OAUTH authent domain
  pulumi config set auth-domain "${domain}"

  # DNS names for endpoints
  pulumi config set accounts-host accounts.${socid}.portal.${domain}
  pulumi config set portal-host ${socid}.portal.${domain}
  pulumi config set probe-host probe.${socid}.portal.${domain}

  # Name of the DNS zone on Google cloud.  This is the zone identifier, not
  # the DNS domain e.g. portal
  pulumi config set dns-zone portal

  # Kubernetes namespace
  pulumi config set k8s-namespace ${socid}

  # Keycloak admin password.  If you change this, undeployment won't work
  pulumi config set --secret keycloak-admin-password <ADMIN-PASS>

  # Initial account details
  pulumi config set initial-user <MY-USERNAME>
  pulumi config set initial-email <MY-EMAIL>

  # A long-live JWT secret.  Only used internally to the system.
  pulumi config set --secret initial-password <MY-PASSWORD>
  pulumi config set --secret jwt-secret $(dd if=/dev/urandom bs=50 count=1 | base64)

```

### Ship it

- `pulumi up`

Just say yes.

### Trust

It deploys on a self-signed cert.  Get the CA cert.

-  `pulumi stack output caCert > ca.crt`

And then load this into your trust mechanism e.g. go to  Keychain Access and
press the plus button to install the CA.

### Login

Go to `https://<portal-host>`

You defined the portal host and initial user/pass above.  This gives you links
to Grafana, Prometheus and Kibana.

### Input data

Point cyberprobe at the probe address you defined above e.g.

```
{
    "interfaces": [ {
            "interface": "enp0s3", "delay": 0,
	    "filter": "not port 9000 and not port 9001"
    } ],
    "targets": [ {
        "address": "10.0.0.0/8", "device": "my-device"
    } ],

    "endpoints": [ {
            "hostname": "<PROBE-ADDRESS>",
            "type": "etsi", "port": 9000, "transport": "tcp"
    } ]
}
```

### Admin

Go to `https://<accounts-host>`, log in using the user 'admin' and the
Keycloak admin password specified above.

## Undeploy

- `pulumi destroy`
- `pulumi stack rm ${socid} -y`

## Configuration

| key                            | purpose |
|--------------------------------|---------|
| portal-host                    | hostname of main web interface         |
| accounts-host                  | hostname of auth interface             |
| probe-host                     | hostname of cyberprobe delivery interface |
| node-type                      | K8s node type (e.g. n1-standard-2      |
| initial-node-count             | Initial k8s node deploy (e.g. 3)       |
| k8s-namespace                  | K8s namespace to use e.g. default      |
| soc-id                         | Soc ID, use to make resource ids e.g. soc |
| dns-zone                       | GCP DNS zone to add settings to        |
| auth-domain                    | Auth domain, should be base of portal-host and account-host |
| initial-user                   | Username of initial user to set up     |
| initial-email                  | Initial user email                     |
| initial-password               | Initial user's initial password        |
| jwt-secret                     | Long-lived secret for JWT tokens       |
| zone                           | GCP deployment zone e.g. eu-west2      |
| region                         | Region e.g. eu-west2-c                 |
| gcp:project                    | Project ID                             |
| auth-client-id                 | (optional) OAUTH client ID             |
| auth-realm-name                | (optional) OAUTH realm                 |
| cassandra-volume-size          | (optional) Disk size                   |
| cassandra-volume-type          | (optional) Disk type e.g. pd-ssd       |
| elasticsearch-volume-size      | (optional) Disk size                   |
| elasticsearch-volume-type      | (optional) Disk type                   |
| gaffer.accumulo-tablet-servers | (optional) Number of Accumulo tablet servers |
| gaffer.hadoop-datanodes        | (optional) Number of Hadoop data nodes |
| gaffer.hadoop-replication      | (optional) Hadoop data replication level |
| gaffer.zookeeper-nodes         | (optional) Number of ZK nodes |
| grafana-org-name               | (optional) Grafana organisation ID |
| hadoop-datanode-size           | (optional) Disk size                   |
| hadoop-namenode-size           | (optional) Disk size                   |
| hadoop-volume-type             | (optional) Disk type                   |
| keycloak-volume-size           | (optional) Disk size                   |
| keycloak-volume-type           | (optional) Disk type                   |
| pulsar-manager-volume-size     | (optional) Disk size                   |
| pulsar-manager-volume-type     | (optional) Disk type                   |
| pulsar-volume-size             | (optional) Disk size                   |
| pulsar-volume-type             | (optional) Disk type                   |
| zookeeper-volume-size          | (optional) Disk size                   |
| zookeeper-volume-type          | (optional) Disk type                   |
