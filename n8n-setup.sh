#!/bin/bash

# Ensure lsb-release is installed for version detection
sudo apt-get update
sudo apt-get install -y lsb-release

# --- 1. System Update & Swap Setup (Crucial for e2-micro) ---
echo "Updating system..."
sudo apt-get update && sudo apt-get upgrade -y

echo "Setting up 2GB swap file..."
# Check if swapfile already exists to avoid errors on re-run
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# --- 2. Install Docker ---
echo "Installing Docker..."
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg software-properties-common

# Add Docker's official GPG key:
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo   "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian   $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# --- 3. Start n8n Container ---
echo "Starting n8n..."
# Create a volume for persistent data if it doesn't exist
docker volume create n8n_data

# Run n8n
# -p 5678:5678: Expose port 5678
# -v n8n_data:/home/node/.n8n: Persist data
# --restart unless-stopped: Auto-restart on crash/reboot
# Using the official image
sudo docker run -d   --name n8n   -p 5678:5678   -e N8N_PORT=5678   -v n8n_data:/home/node/.n8n   --restart unless-stopped   docker.n8n.io/n8nio/n8n

echo "n8n installation complete! Access it at http://<YOUR_VM_IP>:5678"
