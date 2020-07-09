
- Install Pulumi
- npm install
- pulumi login --local
- pulumi stack init dev

- Define configuration

  pulumi config set gcp:project <whatever>
  pulumi config set soc-id soc00
  pulumi config set region us-east1
  pulumi config set zone us-east1-d
  pulumi config set node-type n1-standard-1
  pulumi config set domain cyberapocalypse.co.uk
  pulumi config set accounts-host accounts.$(pulumi config get soc-id).portal.$(pulumi config get domain)
  pulumi config set portal-host $(pulumi config get soc-id).portal.$(pulumi config get domain)

  pulumi config set dns-zone portal
  pulumi config set k8s-namespace $(pulumi config  get soc-id)
  pulumi config set --secret keycloak-admin-password WHATEVER
  pulumi config set initial-user user
  pulumi config set initial-email user@cyberapocalypse.co.uk
  pulumi config set --secret initial-password WHATEVER
  pulumi config set --secret jwt-secret $(dd if=/dev/urandom bs=50 count=1 | base64)

- pulumi up
