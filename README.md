# UK National Lottery Tracker (Static Serverless Edition)

_This exists as a simple proof-of-concept of an iteratively vibe coded static web application that can be hosted on GitHub Pages, with no backend database required._

A lightweight, 100% serverless web application to track your UK National Lottery (Lotto) tickets, view historical results, and monitor your overall Profit & Loss (P/L). 

This project is built using pure HTML, CSS, and vanilla JavaScript, making it perfect for free static hosting solutions like GitHub Pages. It completely bypasses the need for a backend database by leveraging browser storage and GitHub Actions.

(Note that an alternate version of this project exists, as a Python/Flask web application with SQLite database backend, but I converted it to a static site for ease of GitHub Pages hosting.)

## Features

* **Zero Backend Hosting Needed:** Runs entirely in the browser using static files.
* **Automatic Draw Calculations:** Mathematically calculates future draw numbers and dates (Wednesdays and Saturdays).
* **Automated Match Checking:** Compares your saved tickets against historical draws, highlighting matching balls and displaying your match count.
* **Profit & Loss Tracking:** Tracks your total spend (assuming £2 per ticket) and allows you to enter individual ticket winnings to calculate your overall P/L.
* **Ticket Export & Import:** Because your personal ticket and winnings data is saved securely in your browser's `localStorage`, clearing your browser cache would normally delete your data. To prevent this, use the **Export Data** button to download a backup `.json` file. You can restore your tickets at any time, or on any device, using the **Import Data** button.

## How it Works: GitHub Actions

Because a static website cannot securely fetch live XML data from external domains due to CORS restrictions, this project uses GitHub Actions to automate data ingestion. 

There are two GitHub Actions included in the `.github/workflows/` directory:

### 1. Update Draws (`update_draws.yml`)
* **Behavior:** Runs automatically twice a week on a schedule (Wednesdays and Saturdays at 23:00 UTC).
* **What it does:** It runs a Python script that pings the official National Lottery XML endpoint for the latest draw. It extracts the winning numbers and appends them to the `data/draws.json` file in this repository. 
* **Result:** It automatically commits and pushes the new data to the repository, meaning your static GitHub Pages site is instantly updated with the newest results without you having to lift a finger.

### 2. Backfill Database (`backfill_database.yml`)
* **Behavior:** Runs manually on-demand via the GitHub Actions "Workflow Dispatch" UI.
* **What it does:** Perfect for initial setup or fixing corrupted data. When triggered, it queries the live XML feed to find the very latest draw ID. It then iterates backward, fetching the XML data for the **20 most recent draws**, parsing them, and saving them all into `data/draws.json`.
* **Result:** Populates your static site with a healthy chunk of recent historical data to test against your tickets.

## Setup Instructions

1. Fork or clone this repository to your GitHub account.
2. Go to your repository **Settings** -> **Pages**.
3. Under "Build and deployment", set the source to `Deploy from a branch`, and select the `main` branch. 
4. Go to **Settings** -> **Actions** -> **General**, scroll down to **Workflow permissions**, and select **Read and write permissions** (this allows the Actions to save the `draws.json` file back to your repo).
5. Go to the **Actions** tab and manually run the **Backfill Database** workflow to fetch your initial set of historical draws.
6. Visit your live GitHub Pages URL!