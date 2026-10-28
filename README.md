# Coworking Space Service Extension
The Coworking Space Service is a set of APIs that enables users to request one-time tokens and administrators to authorize access to a coworking space. This service follows a microservice pattern and the APIs are split into distinct services that can be deployed and managed independently of one another.

## Image Filter Service

The completed Udacity Image Filter Node.js project is available in [`image-filter/`](image-filter/), including local run instructions and Elastic Beanstalk deployment steps. The repository root is also the deployment entrypoint: run `npm ci` followed by `npm start` from the root for localhost or Elastic Beanstalk. The root start script launches `image-filter/server.js`; the Coworking Space Python/Kubernetes project remains in its existing directories.

The verified reviewer test endpoint is:

```text
http://image-filter-env.eba-yy83tzhg.us-east-1.elasticbeanstalk.com/filteredimage?image_url=https://upload.wikimedia.org/wikipedia/commons/b/bd/Golden_tabby_and_white_kitten_n01.jpg
```

### Elastic Beanstalk CLI and Console Dashboard

The Image Filter service is deployed through the Elastic Beanstalk CLI as application `image-filter-service`, environment `image-filter-env`, in `us-east-1`. The checked-in [`.elasticbeanstalk/config.yml`](.elasticbeanstalk/config.yml) binds `main` to that environment so a clone can run `eb deploy` after AWS credentials are configured.

```bash
eb init image-filter-service --region us-east-1 --platform "Node.js 22 running on 64bit Amazon Linux 2023"
eb create image-filter-env
eb deploy
eb status
```

Manage the deployed environment in the [Elastic Beanstalk Console Dashboard](https://console.aws.amazon.com/elasticbeanstalk/home?region=us-east-1#/environment/dashboard?environmentId=e-fmpypz3fft).

For this project, you are a DevOps engineer who will be collaborating with a team that is building an API for business analysts. The API provides business analysts basic analytics data on user activity in the service. The application they provide you functions as expected locally and you are expected to help build a pipeline to deploy it in Kubernetes.

## Getting Started

### Dependencies
#### Local Environment
1. Python Environment - run Python 3.6+ applications and install Python dependencies via `pip`
2. Docker CLI - build and run Docker images locally
3. `kubectl` - run commands against a Kubernetes cluster
4. `helm` - apply Helm Charts to a Kubernetes cluster

#### Remote Resources
1. AWS CodeBuild - build Docker images remotely
2. AWS ECR - host Docker images
3. Kubernetes Environment with AWS EKS - run applications in k8s
4. AWS CloudWatch - monitor activity and logs in EKS
5. GitHub - pull and clone code

### Setup
#### 1. Configure a Database
Set up a Postgres database using a Helm Chart.

1. Set up Bitnami Repo
```bash
helm repo add <REPO_NAME> https://charts.bitnami.com/bitnami
```

2. Install PostgreSQL Helm Chart
```
helm install <SERVICE_NAME> <REPO_NAME>/postgresql
```

This should set up a Postgre deployment at `<SERVICE_NAME>-postgresql.default.svc.cluster.local` in your Kubernetes cluster. You can verify it by running `kubectl svc`

By default, it will create a username `postgres`. The password can be retrieved with the following command:
```bash
export POSTGRES_PASSWORD=$(kubectl get secret --namespace default <SERVICE_NAME>-postgresql -o jsonpath="{.data.postgres-password}" | base64 -d)

echo $POSTGRES_PASSWORD
```

<sup><sub>* The instructions are adapted from [Bitnami's PostgreSQL Helm Chart](https://artifacthub.io/packages/helm/bitnami/postgresql).</sub></sup>

3. Test Database Connection
The database is accessible within the cluster. This means that when you will have some issues connecting to it via your local environment. You can either connect to a pod that has access to the cluster _or_ connect remotely via [`Port Forwarding`](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)

* Connecting Via Port Forwarding
```bash
kubectl port-forward --namespace default svc/<SERVICE_NAME>-postgresql 5432:5432 &
    PGPASSWORD="$POSTGRES_PASSWORD" psql --host 127.0.0.1 -U postgres -d postgres -p 5432
```

* Connecting Via a Pod
```bash
kubectl exec -it <POD_NAME> bash
PGPASSWORD="<PASSWORD HERE>" psql postgres://postgres@<SERVICE_NAME>:5432/postgres -c <COMMAND_HERE>
```

4. Run Seed Files
We will need to run the seed files in `db/` in order to create the tables and populate them with data.

```bash
kubectl port-forward --namespace default svc/<SERVICE_NAME>-postgresql 5432:5432 &
    PGPASSWORD="$POSTGRES_PASSWORD" psql --host 127.0.0.1 -U postgres -d postgres -p 5432 < <FILE_NAME.sql>
```

### 2. Running the Analytics Application Locally
In the `analytics/` directory:

1. Install dependencies
```bash
pip install -r requirements.txt
```
2. Run the application (see below regarding environment variables)
```bash
<ENV_VARS> python app.py
```

There are multiple ways to set environment variables in a command. They can be set per session by running `export KEY=VAL` in the command line or they can be prepended into your command.

* `DB_USERNAME`
* `DB_PASSWORD`
* `DB_HOST` (defaults to `127.0.0.1`)
* `DB_PORT` (defaults to `5432`)
* `DB_NAME` (defaults to `postgres`)

If we set the environment variables by prepending them, it would look like the following:
```bash
DB_USERNAME=username_here DB_PASSWORD=password_here python app.py
```
The benefit here is that it's explicitly set. However, note that the `DB_PASSWORD` value is now recorded in the session's history in plaintext. There are several ways to work around this including setting environment variables in a file and sourcing them in a terminal session.

3. Verifying The Application
* Generate report for check-ins grouped by dates
`curl <BASE_URL>/api/reports/daily_usage`

* Generate report for check-ins grouped by users
`curl <BASE_URL>/api/reports/user_visits`

## Project Instructions
1. Set up a Postgres database with a Helm Chart
2. Create a `Dockerfile` for the Python application. Use a base image that is Python-based.
3. Write a simple build pipeline with AWS CodeBuild to build and push a Docker image into AWS ECR
4. Create a service and deployment using Kubernetes configuration files to deploy the application
5. Check AWS CloudWatch for application logs

### Deliverables
1. `Dockerfile`
2. Screenshot of AWS CodeBuild pipeline
3. Screenshot of AWS ECR repository for the application's repository
4. Screenshot of `kubectl get svc`
5. Screenshot of `kubectl get pods`
6. Screenshot of `kubectl describe svc <DATABASE_SERVICE_NAME>`
7. Screenshot of `kubectl describe deployment <SERVICE_NAME>`
8. All Kubernetes config files used for deployment (ie YAML files)
9. Screenshot of AWS CloudWatch logs for the application
10. `README.md` file in your solution that serves as documentation for your user to detail how your deployment process works and how the user can deploy changes. The details should not simply rehash what you have done on a step by step basis. Instead, it should help an experienced software developer understand the technologies and tools in the build and deploy process as well as provide them insight into how they would release new builds.


### Stand Out Suggestions
Please provide up to 3 sentences for each suggestion. Additional content in your submission from the standout suggestions do _not_ impact the length of your total submission.
1. Specify reasonable Memory and CPU allocation in the Kubernetes deployment configuration
2. In your README, specify what AWS instance type would be best used for the application? Why?
3. In your README, provide your thoughts on how we can save on costs?

### Best Practices
* Dockerfile uses an appropriate base image for the application being deployed. Complex commands in the Dockerfile include a comment describing what it is doing.
* The Docker images use semantic versioning with three numbers separated by dots, e.g. `1.2.1` and  versioning is visible in the  screenshot. See [Semantic Versioning](https://semver.org/) for more details.

## Coworking Space: build, deploy and evidence

Manifests live in `deployments/` (`postgres.yaml`, `configmap.yaml`, `secret.yaml`, `coworking.yaml`); the Dockerfile is `analytics/Dockerfile`; the pipeline is `buildspec.yaml`. No credentials are committed: `deployments/secret.yaml` holds a placeholder only.

### One immutable tag end to end
CodeBuild tags the image with the first 12 characters of the source commit SHA (`CODEBUILD_RESOLVED_SOURCE_VERSION`) and pushes `<ecr-repo-uri>:<sha>`. It then runs `envsubst` on `deployments/coworking.yaml`, replacing `${ECR_IMAGE_URI}` and `${IMAGE_TAG}`, and publishes `rendered/coworking.yaml` and `imageDetail.json` as build artifacts. The same SHA appears in the CodeBuild log, the ECR tag, the pod image/`image-tag` label and `IMAGE_TAG` env var. Never apply `deployments/coworking.yaml` directly; apply the rendered file.

Make the ECR repository immutable (once):
```bash
aws ecr create-repository --repository-name coworking --image-tag-mutability IMMUTABLE --region <aws-region>
```

### CodeBuild setup (once)
Source: this GitHub repo; environment `aws/codebuild/standard:7.0`, privileged mode; buildspec `buildspec.yaml`; env vars `ECR_REPOSITORY_URI`, `AWS_DEFAULT_REGION`. Enable the webhook under Primary source webhook events, event type `PUSH`, so every push to `main` triggers a build. The service role needs `ecr:GetAuthorizationToken` and, on the repo, `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:DescribeImages`. In the Udacity lab, attach `AmazonEC2ContainerRegistryPowerUser` to the CodeBuild service role (or use `LabRole`).

The ECR repository is immutable, so each commit SHA tag is pushed once; the buildspec skips the push if the tag already exists. If `envsubst` is missing (for example in CloudShell), render the Deployment with `sed -e 's|${ECR_IMAGE_URI}|<uri>:<tag>|g' -e 's|${IMAGE_TAG}|<tag>|g' deployments/coworking.yaml > rendered/coworking.yaml`.

### Deploy
```bash
aws eks update-kubeconfig --name <cluster-name> --region <aws-region>
# Create the DB secret without writing the password to a file
kubectl create secret generic coworking-db-credentials --from-literal=DB_PASSWORD='<strong-password>' --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deployments/postgres.yaml -f deployments/configmap.yaml
kubectl rollout status deployment/postgres
kubectl port-forward svc/postgres 5432:5432 &
for f in db/1_create_tables.sql db/2_seed_users.sql db/3_seed_tokens.sql; do PGPASSWORD='<strong-password>' psql -h 127.0.0.1 -U postgres -d postgres -p 5432 < $f; done

# Render the Deployment locally (or download rendered/coworking.yaml from the CodeBuild artifact)
export IMAGE_TAG=<commit-sha-12>
export ECR_IMAGE_URI=<account-id>.dkr.ecr.<aws-region>.amazonaws.com/coworking:$IMAGE_TAG
envsubst '${ECR_IMAGE_URI} ${IMAGE_TAG}' < deployments/coworking.yaml > rendered-coworking.yaml
kubectl apply -f rendered-coworking.yaml
kubectl rollout status deployment/coworking
```
EKS nodes need ECR pull permission (the default node role includes `AmazonEC2ContainerRegistryReadOnly`).

### Required screenshots and the command for each
| Rubric item | Capture |
|---|---|
| ECR image list | ECR console > `coworking` > Images (tag = commit SHA), or `aws ecr describe-images --repository-name coworking --region <aws-region>` |
| Auto-triggered CodeBuild | Push a commit to `main`; screenshot Build history showing source version = the commit SHA, trigger = webhook, status Succeeded, plus the ECR image with the same tag |
| Functional YAML | `kubectl get deployment coworking -o jsonpath='{.spec.template.spec.containers[0].image}'` shows the real ECR URI |
| Service, deployment, pod | `kubectl get svc`, `kubectl get deployments`, `kubectl get pods`, `kubectl describe deployment coworking` |
| PostgreSQL service | `kubectl describe svc postgres` |
| CloudWatch logs | CloudWatch > Log groups > `/aws/containerinsights/<cluster-name>/application` > the coworking stream showing `GET /health_check ... 200` / `GET /readiness_check ... 200`; or `aws logs tail /aws/containerinsights/<cluster-name>/application --since 1h --region <aws-region>` |

Verify the app: `curl http://<coworking-loadbalancer-host>:5153/api/reports/daily_usage`.
To confirm traceability, `kubectl get pods -l service=coworking -L image-tag` should show the SHA from the CodeBuild build.

### Container Insights logging
Install the `amazon-cloudwatch-observability` EKS add-on (installs CloudWatch agent and Fluent Bit) and attach `CloudWatchAgentServerPolicy` to the node role or a pod-identity role:
```bash
aws iam attach-role-policy --role-name <node-or-pod-identity-role> --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
aws eks create-addon --cluster-name <cluster-name> --addon-name amazon-cloudwatch-observability --region <aws-region>
kubectl get pods -n amazon-cloudwatch
```

### Resources, node type and cost
Coworking requests 100m CPU/128Mi (limits 250m/256Mi); PostgreSQL requests 250m/256Mi (limits 500m/512Mi). `t3.medium` nodes fit this plus system and observability pods. Save cost with right-sized requests, autoscaling idle nodes, and ECR lifecycle and CloudWatch retention policies.

The pipeline is triggered by every push to `main`; each push builds and pushes an image tagged with that commit's 12-character SHA.
