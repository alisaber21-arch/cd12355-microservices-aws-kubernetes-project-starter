# Coworking Space Service Extension

This repository packages the analytics reporting service and its Kubernetes delivery artifacts.

## Architecture and deployment

The analytics container is built from `analytics/`, published to ECR by CodeBuild, and exposed through the `coworking` LoadBalancer on port 5153.
At runtime, `coworking-config` supplies non-sensitive PostgreSQL connection settings, `coworking-db-credentials` supplies only `DB_PASSWORD`, and the internal `postgres` Service fronts the database.
PostgreSQL stores state in the `postgres-data` `ReadWriteOnce` PVC, which EKS dynamically provisions through its default EBS-backed StorageClass rather than a static PersistentVolume.

Before applying `deployments/secret.yaml`, replace `REPLACE_WITH_A_STRONG_POSTGRES_PASSWORD` in a local uncommitted copy with a strong password.
```bash
kubectl apply -f deployments/secret.yaml
```
Alternatively, create the secret without putting a password in a file:
```bash
kubectl create secret generic coworking-db-credentials \
  --from-literal=DB_PASSWORD='<strong-password>' \
  --dry-run=client -o yaml | kubectl apply -f -
```
After taking exactly one credential action, apply the database manifests, wait for the PVC and database Deployment, seed the SQL files through a port-forward, replace `REPLACE_WITH_ECR_IMAGE_URI` with the immutable ECR image URI, and then apply the coworking manifests.
```bash
kubectl apply -f deployments/postgres.yaml
kubectl apply -f deployments/configmap.yaml
kubectl get pvc postgres-data
kubectl rollout status deployment/postgres
kubectl port-forward svc/postgres 5432:5432
PGPASSWORD='<strong-password>' psql -h 127.0.0.1 -U postgres -d postgres -p 5432 < db/1_create_tables.sql
PGPASSWORD='<strong-password>' psql -h 127.0.0.1 -U postgres -d postgres -p 5432 < db/2_seed_users.sql
PGPASSWORD='<strong-password>' psql -h 127.0.0.1 -U postgres -d postgres -p 5432 < db/3_seed_tokens.sql
kubectl apply -f deployments/coworking.yaml
```
Use the following to verify the deployed resources:
```bash
kubectl get svc
kubectl get pods
kubectl describe service postgres
kubectl describe deployment coworking
```

## Image build and release

Create a CodeBuild project using this GitHub repository as the source, the `aws/codebuild/standard:7.0` managed Ubuntu image, privileged mode, and `buildspec.yaml`.
Set plaintext `ECR_REPOSITORY_URI`, `AWS_DEFAULT_REGION`, `IMAGE_VERSION_MAJOR`, and `IMAGE_VERSION_MINOR` environment variables, and use a CodeBuild role with `ecr:GetAuthorizationToken` plus `ecr:BatchCheckLayerAvailability`, `ecr:CompleteLayerUpload`, `ecr:InitiateLayerUpload`, `ecr:PutImage`, and `ecr:UploadLayerPart` on the target repository, along with standard source-artifact and CloudWatch Logs permissions.
`buildspec.yaml` logs in using `aws ecr get-login-password`, builds the `analytics` context, and pushes the visible semantic image tag `${IMAGE_VERSION_MAJOR:-1}.${IMAGE_VERSION_MINOR:-0}.${CODEBUILD_BUILD_NUMBER}`.
Use `imageDetail.json` or the ECR image URI from that build to update the configured placeholder in the coworking Deployment.

```bash
aws codebuild list-builds-for-project --project-name "<codebuild-project-name>" --region "<aws-region>"
aws ecr describe-images --repository-name "<ecr-repository-name>" --region "<aws-region>"
```

## CloudWatch Container Insights

Run these commands only from an authenticated administrator workstation with AWS CLI, an active `kubectl` context, an EKS cluster running Kubernetes 1.23 or later, and an IAM role trusted by `pods.eks.amazonaws.com`.
Attach `CloudWatchAgentServerPolicy` to that role, install the EKS Pod Identity Agent only if absent, and install the Amazon CloudWatch Observability add-on, which installs both the CloudWatch agent and Fluent Bit.
```bash
export CLUSTER_NAME="<cluster-name>"
export AWS_REGION="<aws-region>"
export CLOUDWATCH_AGENT_ROLE_ARN="<cloudwatch-agent-pod-identity-role-arn>"
aws iam attach-role-policy --role-name "<cloudwatch-agent-role-name>" --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
aws eks create-addon --cluster-name "$CLUSTER_NAME" --addon-name eks-pod-identity-agent --region "$AWS_REGION"
aws eks create-addon --cluster-name "$CLUSTER_NAME" --addon-name amazon-cloudwatch-observability --pod-identity-associations "serviceAccount=cloudwatch-agent,roleArn=$CLOUDWATCH_AGENT_ROLE_ARN" --region "$AWS_REGION"
kubectl get daemonsets -n amazon-cloudwatch
kubectl get pods -n amazon-cloudwatch
aws logs tail "/aws/containerinsights/$CLUSTER_NAME/application" --since 1h --region "$AWS_REGION"
```
Capture the CodeBuild build details, ECR tag list, Kubernetes command output, CloudWatch Container Insights cluster performance view, and the `/aws/containerinsights/<cluster-name>/application` analytics logs for the assignment evidence.

## Troubleshooting

If coworking is not ready, inspect the controller and pod logs, then verify its ConfigMap and Secret references, PostgreSQL service endpoints and DNS, and PVC binding.
```bash
kubectl describe deployment coworking
kubectl logs deployment/coworking --all-containers=true
kubectl logs pod/<coworking-pod-name>
kubectl get configmap coworking-config -o yaml
kubectl get secret coworking-db-credentials
kubectl get endpointslices -l kubernetes.io/service-name=postgres
kubectl run postgres-dns-test --rm -it --restart=Never --image=busybox:1.36 -- nslookup postgres
kubectl describe pvc postgres-data
```
The readiness probe queries the `tokens` table, so a database connection failure or unseeded database keeps the pod unready.
After changing an image, ConfigMap, or Secret, restart and monitor the controller instead of deleting generated pods.
```bash
kubectl rollout restart deployment/coworking
kubectl rollout status deployment/coworking
```

## Standout suggestions

### Resources
Coworking requests 100m CPU and 128Mi memory with 250m CPU and 256Mi limits, while PostgreSQL reserves 250m CPU and 256Mi memory with 500m CPU and 512Mi limits to cover database caching and storage work.

### EKS node type
`t3.medium` is a practical initial worker type because its two vCPUs and 4 GiB of memory leave room for the application, PostgreSQL, CoreDNS, and observability DaemonSets.

### Cost control
Use Container Insights to right-size requests, remove idle capacity with Cluster Autoscaler or Karpenter, and configure ECR lifecycle and CloudWatch log-retention policies for unused images and stale logs.
