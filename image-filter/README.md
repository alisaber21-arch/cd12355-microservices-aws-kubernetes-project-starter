# Udacity Image Filter Service

This self-contained Node.js service exposes `GET /filteredimage?image_url=...`. It downloads an HTTP(S) image, resizes it to a width of 256 pixels, converts it to grayscale, and returns a JPEG response. Generated files are stored in the operating system temporary directory and are removed when the response finishes or closes.

## Local use

Requirements: Node.js 22 or newer and npm.

From the repository root (the recommended command for deployment validation):

```bash
npm ci
npm start
```

Or run the service independently from this directory:

```bash
cd image-filter
npm install
npm start
```

The service listens on `http://localhost:8082` by default. Set `PORT` to change it:

```bash
PORT=8080 npm start
```

Filter a publicly accessible image:

```bash
curl --get "http://localhost:8082/filteredimage" \
  --data-urlencode "image_url=https://example.com/photo.jpg" \
  --output filtered.jpg
```

The endpoint returns:

| Status | Meaning |
| --- | --- |
| 400 | `image_url` is absent, empty, malformed, or not HTTP(S). |
| 422 | The URL cannot be accessed. |
| 415 | The response is not an image or cannot be decoded as one. |
| 500 | An unexpected server-side failure occurred. |

## Deploying to Elastic Beanstalk

Install the [AWS EB CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html), configure AWS credentials with permission to create Elastic Beanstalk resources, then run these commands from the repository root. Elastic Beanstalk detects the root `package.json` and runs its `start` script, which launches this service. The committed [`.elasticbeanstalk/config.yml`](../.elasticbeanstalk/config.yml) binds application `image-filter-service`, environment `image-filter-env`, region `us-east-1`, and the `main` branch:

```bash
cd <repository-root>
npm ci
eb init image-filter-service --region us-east-1 --platform "Node.js 22 running on 64bit Amazon Linux 2023"
```

Create the environment when it does not exist, deploy the application, and inspect its status:

```bash
eb create image-filter-env
eb deploy
eb status
```

The verified deployment runs in the `image-filter-env` environment in `us-east-1`. The verified reviewer test endpoint is:

```text
http://image-filter-env.eba-yy83tzhg.us-east-1.elasticbeanstalk.com/filteredimage?image_url=https://upload.wikimedia.org/wikipedia/commons/b/bd/Golden_tabby_and_white_kitten_n01.jpg
```

The environment can be monitored and managed in the [Elastic Beanstalk Console Dashboard](https://console.aws.amazon.com/elasticbeanstalk/home?region=us-east-1#/environment/dashboard?environmentId=e-fmpypz3fft).

Elastic Beanstalk supplies `PORT`; `server.js` uses it automatically.
