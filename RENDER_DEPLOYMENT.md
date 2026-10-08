# Step-by-Step Guide: Deploying CPMS for Free on Render

This guide walks you through deploying your **Capstone Proposal Management System** on [Render.com](https://render.com) with a free PostgreSQL database so anyone can access it online.

---

## What You Need (All 100% Free)
1. A **GitHub** account (to store your code).
2. A **Render** account (to run the web app for free).
3. A **Neon** account (to host the PostgreSQL database free forever).

---

## Step 1: Create Your Free PostgreSQL Database on Neon (1 Minute)

1. Open [neon.tech](https://neon.tech) and sign up for free (click **Sign up with GitHub** or **Google**).
2. In the dashboard, click **Create Project**.
   - **Name**: `cpms-db`
   - **Postgres version**: Default (16)
   - Click **Create Project**.
3. Under **Connection Details**, copy your **Connection String**:
   - It looks like:
     ```
     postgres://alex:xyz@ep-sparkling-pool-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   *(Keep this copied, you will paste it into Render in Step 3!)*

---

## Step 2: Push Your Code to GitHub (2 Minutes)

If you have not already pushed your code to GitHub:
1. Go to [github.com/new](https://github.com/new) and create a new repository (e.g. `capstone-proposal-system`).
2. Open PowerShell in your project folder and run:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

---

## Step 3: Deploy the Web Service on Render (2 Minutes)

1. Go to [render.com](https://render.com) and click **Get Started for Free** (log in with your GitHub account).
2. From the dashboard, click the blue **New +** button in the top right &rarr; select **Web Service**.
3. Under **Connect a repository**, find your repository and click **Connect**.
4. Configure the settings:
   - **Name**: `cpms-capstone` (or any name you like)
   - **Language / Runtime**: Choose **Docker**
   - **Region**: Oregon (or Singapore / Frankfurt, whichever is closest)
   - **Instance Type**: Select **Free ($0/month)**
5. Scroll down to **Environment Variables** and click **Add Environment Variable**:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `HOST` | `0.0.0.0` |
   | `DATABASE_URL` | *(Paste your Neon connection string from Step 1)* |
   | `JWT_SECRET` | `cpms_secure_secret_2026_key` |
6. Click **Deploy Web Service** at the bottom!

---

## What Happens Next:
- Render will pull your Docker image, install dependencies, compile the frontend, and run the Express server.
- The server will automatically connect to your Neon database and initialize all normalized tables (`users`, `groups`, `tasks`, `submissions`, `evaluations`) on the first run.
- In about 2 minutes, Render will display your live public URL (e.g., `https://cpms-capstone.onrender.com`).
- Anyone on mobile, tablet, or PC can now access and use the Capstone system!
