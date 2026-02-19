# n8n on Google Cloud Platform (Free Tier) Setup Guide

This guide will help you set up a self-hosted n8n instance on Google Cloud Platform (GCP) using a free-tier eligible **e2-micro** Virtual Machine.

## Prerequisites
- A Google Cloud Platform account.
- A Billing Account linked to your project (required even for free tier).

## Step 1: Create a Virtual Machine

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Navigate to **Compute Engine** > **VM instances**.
3.  Click **Create Instance**.
4.  **Name:** `n8n-server` (or any name you prefer).
5.  **Region:** Choose a free-tier eligible region (usually `us-central1`, `us-west1`, or `us-east1`).
6.  **Machine configuration:**
    -   **Series:** `E2`
    -   **Machine type:** `e2-micro` (2 vCPU, 1 GB memory).
7.  **Boot disk:**
    -   Click **Change**.
    -   **Operating System:** `Debian`.
    -   **Version:** `Debian GNU/Linux 11 (bullseye)` or `12 (bookworm)`.
    -   **Boot disk type:** `Standard persistent disk`.
    -   **Size:** `30` GB (Free tier allows up to 30GB).
    -   Click **Select**.
8.  **Firewall:** Check both **Allow HTTP traffic** and **Allow HTTPS traffic**.

## Step 2: Add Startup Script

This is the most important step. We will use a script to automatically install Docker and start n8n.

1.  Scroll down and expand the **Advanced options** section.
2.  Expand the **Management** section.
3.  Locate the **Automation** > **Startup script** box.
4.  Copy the entire content of the `n8n-setup.sh` file provided in this repository and paste it into this box.

## Step 3: Create the Instance

1.  Click **Create** at the bottom of the page.
2.  Wait a few minutes for the instance to start.

## Step 4: Configure Firewall Rule

By default, GCP blocks port `5678` (n8n's port). We need to open it.

1.  Go to **VPC network** > **Firewall**.
2.  Click **Create Firewall Rule**.
3.  **Name:** `allow-n8n`
4.  **Targets:** `All instances in the network`
5.  **Source IPv4 ranges:** `0.0.0.0/0` (Allows access from anywhere).
6.  **Protocols and ports:**
    -   Check **TCP**.
    -   Enter `5678` in the port field.
7.  Click **Create**.

## Step 5: Access n8n

1.  Go back to **Compute Engine** > **VM instances**.
2.  Find your `n8n-server` and copy its **External IP**.
3.  Open your browser and visit: `http://<YOUR_EXTERNAL_IP>:5678`
4.  You should see the n8n setup screen!

## Optional: Pointing Your Domain (Essenshaw.com)

If you want to access n8n via `n8n.essenshaw.com`:

1.  Log in to your domain registrar (where you bought `essenshaw.com`).
2.  Create an **A Record**.
    -   **Host:** `n8n` (or `@` for the root domain).
    -   **Value:** The **External IP** of your VM.
    -   **TTL:** Default (e.g., 3600).
3.  Wait for propagation.
4.  You can then access it at `http://n8n.essenshaw.com:5678`.

*Note: For HTTPS (SSL), you would need to set up a reverse proxy like Nginx or Traefik, which is a more advanced setup.*
