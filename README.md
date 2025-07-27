# Bangla News Content Automator

This contains everything you need to run your app locally and deploy it to Vercel for automated, serverless execution.

**SECURITY WARNING:** The Gemini API key is currently hardcoded in the `apiKey.ts` file. This is a significant security risk. If you push this code to a public repository (like GitHub), your API key will be exposed. It is **strongly recommended** to revert this change and use environment variables for production deployments.

## Run Locally

**Prerequisites:** Node.js

1.  Install dependencies:
    `npm install`
2.  Run the app:
    `npm run dev`

---

## Deploy to Vercel

This application is designed to be deployed to Vercel and triggered by Vercel Cron Jobs.

### Step 1: Push to GitHub
Push your project code to a new repository on GitHub. **Remember the security warning above.**

### Step 2: Import Project on Vercel
1.  Sign up or log in to [Vercel](https://vercel.com).
2.  Click "Add New..." -> "Project".
3.  Import the GitHub repository you just created.
4.  Vercel will automatically detect that this is a Vite project and configure the build settings correctly.

### Step 3: Deploy
Go to the **Deployments** tab and trigger a new deployment. Since the API key is hardcoded, no environment variable configuration is needed. Once deployed, you will get a public URL (e.g., `https://your-project-name.vercel.app`).

### Step 4: Configure Vercel Cron Jobs
1.  Create a `vercel.json` file in the root of your project with the following content. This tells Vercel how to run your cron jobs.

    ```json
    {
      "crons": [
        {
          "path": "/?action=start",
          "schedule": "0 18 * * *"
        }
      ]
    }
    ```
    *   The `path` must be `/?action=start` to trigger your application's automation logic.
    *   The `schedule` uses standard cron syntax. `"0 18 * * *"` means "run at 6:00 PM UTC every day". You can adjust this as needed. Use a tool like [crontab.guru](https://crontab.guru/) to help create your desired schedule.

2.  Push the `vercel.json` file to your GitHub repository. Vercel will automatically detect it and schedule the cron job on your next deployment. You can check the status of your cron jobs in the **Cron Jobs** tab of your Vercel project dashboard.