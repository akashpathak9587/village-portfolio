# Jenkins controller with Docker CLI + Ansible preinstalled, ready to run this project's Jenkinsfile.
FROM jenkins/jenkins:lts-jdk17

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg git openssh-client python3 python3-pip pipx \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && chmod a+r /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin ansible \
 && rm -rf /var/lib/apt/lists/*

USER jenkins
RUN ansible-galaxy collection install community.docker \
 && jenkins-plugin-cli --plugins \
      git workflow-aggregator pipeline-stage-view credentials-binding ssh-credentials timestamper github
