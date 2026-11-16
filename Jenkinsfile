// Jenkins declarative pipeline: build → smoke test → push to registry → deploy with Ansible.
//
// Jenkins credentials required (Manage Jenkins → Credentials):
//   dockerhub-creds   (Username with password)  – Docker Hub user + access token
//   deploy-ssh-key    (SSH Username with private key) – key that can SSH into the target servers
//
// Agent requirements: docker CLI (with access to a Docker daemon), ansible, git.
// See jenkins/ for a ready-made Jenkins image that has all of these.

pipeline {
  agent any

  parameters {
    booleanParam(name: 'DEPLOY', defaultValue: true, description: 'Deploy to servers with Ansible after a successful build')
    string(name: 'ANSIBLE_LIMIT', defaultValue: 'web', description: 'Inventory group/host to deploy to')
  }

  environment {
    IMAGE_NAME = 'akashpathak9587/village-portfolio'   // <-- change me
    IMAGE_TAG  = "${env.BUILD_NUMBER}"
    SMOKE_NAME = "vp-smoke-${env.BUILD_NUMBER}"
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
        echo "Building commit ${env.GIT_SHORT}"
      }
    }

    stage('Build image') {
      // The multi-stage Dockerfile runs `npm ci` and `npm run build`, so a failed
      // React/Vite build fails this stage. No Node.js is needed on the agent.
      steps {
        sh '''
          docker build --pull \
            -t ${IMAGE_NAME}:${IMAGE_TAG} \
            -t ${IMAGE_NAME}:${GIT_SHORT} \
            -t ${IMAGE_NAME}:latest .
        '''
      }
    }

    stage('Smoke test') {
      steps {
        sh '''
          docker run -d --name ${SMOKE_NAME} ${IMAGE_NAME}:${IMAGE_TAG}
          for i in $(seq 1 15); do
            if docker exec ${SMOKE_NAME} wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1; then break; fi
            sleep 1
          done
          docker exec ${SMOKE_NAME} wget -qO- http://127.0.0.1/healthz
          docker exec ${SMOKE_NAME} wget -qO- http://127.0.0.1/ | grep -q '<div id="root">'
          echo "Smoke test passed"
        '''
      }
      post {
        always { sh 'docker rm -f ${SMOKE_NAME} || true' }
      }
    }

    stage('Push image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            echo "$REG_PASS" | docker login -u "$REG_USER" --password-stdin
            docker push ${IMAGE_NAME}:${IMAGE_TAG}
            docker push ${IMAGE_NAME}:${GIT_SHORT}
            docker push ${IMAGE_NAME}:latest
          '''
        }
      }
    }

    stage('Deploy with Ansible') {
      when { expression { return params.DEPLOY } }
      steps {
        withCredentials([
          sshUserPrivateKey(credentialsId: 'deploy-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
          usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS'),
        ]) {
          dir('ansible') {
            // Registry credentials reach Ansible through env vars (read in group_vars/all.yml),
            // so they never appear on the command line or in the build log.
            sh '''
              export REGISTRY_USERNAME="$REG_USER" REGISTRY_PASSWORD="$REG_PASS"
              ansible-galaxy collection install -r requirements.yml
              ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook deploy.yml \
                -i inventory.ini \
                --limit "${ANSIBLE_LIMIT}" \
                -u "$SSH_USER" --private-key "$SSH_KEY" \
                -e "image_name=${IMAGE_NAME} image_tag=${IMAGE_TAG}"
            '''
          }
        }
      }
    }
  }

  post {
    always {
      sh 'docker logout || true'
      // Keep the agent's disk tidy: remove this build's local tags.
      sh 'docker rmi ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:${GIT_SHORT} || true'
    }
    success { echo "✅ ${IMAGE_NAME}:${IMAGE_TAG} built${params.DEPLOY ? ' and deployed' : ''}." }
    failure { echo '❌ Pipeline failed — check the stage logs above.' }
  }
}
