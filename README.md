
# Event stream cluster

## Deployment

### Install

- Install Pulumi
- `npm install`
- `pulumi login --local`

### Define stack

```
  socid=<MY-DOMAIN>
  domain=cyberapocalypse.co.uk
  pulumi stack init ${socid}
  pulumi config set gcp:project <GOOGLE-PROJECT>
  pulumi config set soc-id ${socid}
  pulumi config set region us-east1
  pulumi config set zone us-east1-d
  pulumi config set node-type n1-standard-2
  pulumi config set initial-node-count 3
  pulumi config set auth-domain "${domain}"
  pulumi config set accounts-host accounts.${socid}.portal.${domain}
  pulumi config set portal-host ${socid}.portal.${domain}
  pulumi config set probe-host probe.${socid}.portal.${domain}
  pulumi config set dns-zone portal
  pulumi config set k8s-namespace ${socid}
  pulumi config set --secret keycloak-admin-password <ADMIN-PASS>
  pulumi config set initial-user <MY-USERNAME>
  pulumi config set initial-email <MY-EMAIL>
  pulumi config set --secret initial-password <MY-PASSWORD>
  pulumi config set --secret jwt-secret $(dd if=/dev/urandom bs=50 count=1 | base64)

```

### Ship it

- `pulumi up`

### Undeploy

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
