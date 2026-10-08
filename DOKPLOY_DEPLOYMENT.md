# Dokploy Deployment Guide

This guide walks you through deploying the **Capstone Proposal Management System (CPMS)** onto [Dokploy](https://dokploy.com).

---

## Deployment Options in Dokploy

Dokploy offers two great ways to deploy this application:
1. **Option A (Recommended): Dokploy Application + Dokploy Managed PostgreSQL**
2. **Option B: Dokploy Compose (Stack)**

---

## Option A: Dokploy Application + Managed PostgreSQL (Recommended)

### Step 1: Create a PostgreSQL Database in Dokploy
1. In your Dokploy dashboard, go to your project.
2. Click **Create Service** &rarr; select **Database** &rarr; choose **PostgreSQL**.
3. Name your database (e.g., `cpms-db`).
4. Set the database name to `cpms_db`.
5. Click **Deploy**.
6. Once deployed, find the **Internal Connection String** under the database settings:
   `postgres://postgres:<password>@<database-container-name>:5432/cpms_db`

### Step 2: Create the Application
1. In the same project, click **Create Service** &rarr; select **Application**.
2. Name your application (e.g., `cpms-app`).
3. Under **Source**, choose your Git Provider (GitHub / GitLab / Git Repository) and select this repository branch.
4. Under **Build Type**, choose **Dockerfile**.
5. Set:
   - **Dockerfile Path**: `Dockerfile`
   - **Context Path**: `/`

### Step 3: Configure Environment Variables
In your Application settings &rarr; **Environment** tab, add:
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgres://postgres:<password>@<database-container-name>:5432/cpms_db
JWT_SECRET=your_custom_secure_jwt_secret_key_here
```

### Step 4: Configure Domain and Ports
1. Go to the **Domains** tab in your Application.
2. Click **Add Domain** and enter your desired domain (e.g., `cpms.yourdomain.com`).
3. Set **Container Port** to `3000`.
4. Enable **HTTPS / SSL (Let's Encrypt)**.

### Step 5: Deploy
1. Click **Deploy** in the top right.
2. Dokploy will run the multi-stage build, compile the frontend assets, initialize the PostgreSQL 3NF database schema, and launch the production server on port 3000.

---

## Option B: Deploying via Dokploy Compose

If you prefer to run both the Node full-stack app and PostgreSQL in a single compose stack:

1. In Dokploy, click **Create Service** &rarr; select **Compose**.
2. Name your stack (e.g., `cpms-stack`).
3. Choose **Git Repository** or paste the contents of `docker-compose.yml`.
4. In the **Environment Variables** tab, define:
   ```env
   NODE_ENV=production
   PORT=3000
   POSTGRES_DB=cpms_db
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_db_password
   JWT_SECRET=your_secure_jwt_secret
   ```
5. Add your domain mapping to the `app` service on port `3000`.
6. Click **Deploy**.

---

## Verification Checklist After Deployment
- [x] Visiting your domain serves the CPMS login portal.
- [x] Initial seed data is automatically migrated into PostgreSQL 3NF normalized tables on the first run.
- [x] Submitting deliverables as a student transitions status to **Submitted** and locks re-uploading.
- [x] Panel defense evaluations, annotations, rubrics, and coordinator reports persist reliably in PostgreSQL.

