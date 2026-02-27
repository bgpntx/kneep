pipeline {
    agent any

    environment {
        DEPLOY_HOST   = "${env.PROD_IP_KNEEP}"
        DEPLOY_PORT   = "${env.PROD_PORT_KNEEP}"
        DEPLOY_USER   = "${env.PROD_USER_KNEEP}"
        DEPLOY_PATH   = "${env.DEPLOY_PATH_KNEEP}"
        DEPLOY_BRANCH = "${env.DEPLOY_BRANCH_KNEEP}"
        // This pulls the secret text credential named 'discord_bug' into the env variable
        DISCORD_URL   = credentials('discord_bug')
    }

    stages {
        stage('Deploy to Server') {
            steps {
                // Ensure 'deploy-ssh' matches the ID of the SSH Key credential in Jenkins 
                // that gives access to the 'bug' user on 'nest.vps.pw'
                sshagent(['deploy-ssh']) {
                    sh """
                        # Connect to remote server
                        ssh -p ${DEPLOY_PORT} -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} "
                            # Stop script on first error
                            set -e
                            
                            echo 'Navigating to project directory...'
                            cd ${DEPLOY_PATH}

                            echo 'Pulling changes for branch ${DEPLOY_BRANCH}...'
                            # Ensure we are on the correct branch
                            git checkout ${DEPLOY_BRANCH}
                            git pull origin ${DEPLOY_BRANCH}

                            echo 'Running rebuild script...'
                            bash rebuild.sh

                            echo 'Deployment Finished Successfully!'
                        "
                    """
                }
            }
        }
    }

    post {
        success {
            discordSend description: ":white_check_mark: **Deploy to ${DEPLOY_HOST} (Kneep) was successful!**", 
                        footer: "Jenkins Build #${env.BUILD_NUMBER}", 
                        link: env.BUILD_URL, 
                        result: 'SUCCESS', 
                        title: "Kneep Deployment Success", 
                        webhookURL: env.DISCORD_URL
        }
        failure {
            discordSend description: ":no_entry: **Deploy to ${DEPLOY_HOST} (Kneep) FAILED!**\nCheck logs for details.", 
                        footer: "Jenkins Build #${env.BUILD_NUMBER}", 
                        link: env.BUILD_URL, 
                        result: 'FAILURE', 
                        title: "Kneep Deployment Error", 
                        webhookURL: env.DISCORD_URL
        }
    }
}
