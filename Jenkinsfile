pipeline {
    agent any

    environment {
        DEPLOY_HOST   = 'nest.vps.pw'
        DEPLOY_PORT   = '2562'
        DEPLOY_USER   = 'bug'
        DEPLOY_PATH   = '/home/bug/git/kneep'
        DEPLOY_BRANCH = 'dev'
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

                            echo 'Cleaning and Installing Dependencies...'
                            rm -rf node_modules dist
                            npm install
                            npm audit fix --force

                            echo 'Building Project...'
                            npm run build

                            echo 'Restarting Docker Containers...'
                            docker compose down -v
                            docker compose build --no-cache
                            docker compose -p kneep up -d

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
