<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->
# ACTABLE AI

## Debugging in VS-Code - <mark>Do not commit these changes they are only for development.</mark>
---
Tuturial on how to Debug in VS-Code

### Extensions Required
- Docker


### Steps

In `docker-compose.yml` change the following lines from this

```DockerFile
  superset:
    build: *actableai-build
    command:
      [
        'flask',
        'run',
        '-p',
        '8088',
        '--with-threads',
        '--reload',
        '--debugger',
        '--host=0.0.0.0',
      ]
```
to this
```js
  superset:
    build: *actableai-build
    command:
        ["tail", "-f", "/dev/null"]
```

In `DockerFile` remove the highlighted line

```Dockerfile
FROM lean AS dev

USER root

COPY ./requirements-dev.txt ./docker/requirements* /app/
RUN pip install -r /app/requirements-dev.txt


USER superset <----- DELETE THIS LINE
```

Add the following configuration into your `launch.json` located in the `/.vscode` folder

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: ActableAI-App",
      "type": "python",
      "request": "launch",
      "module": "flask",
      "env": {
        "FLASK_APP": "superset/app.py",
        "FLASK_ENV": "development"
      },
      "args": [
        "run",
        "-p",
        "8088",
        "--with-threads",
        "--reload",
        "--debugger",
        "--host=0.0.0.0",
      ],
      "jinja": true
    }
  ]
}
```

Run the following commands so that your local docker image is **REBUILT** and **STARTED**

```properties
docker-compose down
docker-compose up -d --build
```

After installing the Docker Extension. Open it and find the `actable_superset_1` container.

<img
  src="./docs/dev/Attach VS-Code to docker.png"
  width="500"
/>

A new VS-Code window should open up and it should be targeting the app folder inside the docker container. 
Open the Debug sidebar and launch the configuration you added in the `launch.json` file 


<img
  src="./docs/dev/Debug App.png"
  width="500"
/>


## Git Submodules Guide
---

Full documentation available here: https://git-scm.com/book/en/v2/Git-Tools-Submodules

Git Submodules is a feature used to contain the actableai-ml library directly in the working directory at specific commit.
When cloning for the first time the repository this command should be executed:
```shell
git submodule update --init --recursive
```

Then when pulling new changes you can either run the command above after pulling or directly use this command:
```shell
git pull --recurse-submodules
```

Finally when the submodule content needs to be updated to a specific commit the following commands must be executed:
```shell
cd actableai-ml
git fetch --all
git checkout <commit_hash>
cd ..
git add actableai-ml
```
