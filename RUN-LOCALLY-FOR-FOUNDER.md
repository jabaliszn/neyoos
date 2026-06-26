# RUN NEYO LOCALLY — Founder Beginner Guide

> This guide is written for a founder with **zero coding experience**. Follow it slowly, one step at a time. Do not skip steps.

---

# 0. What you are trying to do

You want to run NEYO on your own computer so you can open it like a normal website and click buttons yourself.

When it is running, you will open this in your browser:

```txt
http://localhost:3000/login?tenant=karibu-high
```

`localhost` means:

```txt
my own computer
```

So NEYO will not yet be online for the public. It will run only on your laptop/computer.

---

# 1. What is the Terminal?

The **Terminal** is a typing window where you give instructions to your computer.

Instead of clicking buttons, you type commands like:

```bash
npm install
```

Think of it like sending direct instructions to your computer.

---

# 2. How to open the Terminal

## If you are using Windows

Use **PowerShell**.

### Option A — easiest

1. Click the **Start Menu** button.
2. Type:

```txt
PowerShell
```

3. Click:

```txt
Windows PowerShell
```

A blue or black typing window will open.

That is your terminal.

### Option B — inside your project folder later

When you have your project folder open:

1. Hold **Shift** on your keyboard.
2. Right-click inside the folder.
3. Click:

```txt
Open PowerShell window here
```

or:

```txt
Open in Terminal
```

---

## If you are using Mac

Use **Terminal**.

1. Press:

```txt
Command + Space
```

2. Type:

```txt
Terminal
```

3. Press **Enter**.

A white/black typing window opens.

That is your terminal.

---

# 3. Things you must install first

You need 2 things:

1. Node.js
2. Git

---

## 3.1 Install Node.js

Go to:

```txt
https://nodejs.org
```

Download the **LTS** version.

Install it like any normal app:

```txt
Next → Next → Install → Finish
```

After installing, close PowerShell/Terminal and open it again.

Then type:

```bash
node -v
```

Press Enter.

You should see something like:

```txt
v20.20.2
```

Then type:

```bash
npm -v
```

You should see something like:

```txt
10.8.2
```

If you see versions, Node is installed.

---

## 3.2 Install Git

Go to:

```txt
https://git-scm.com/downloads
```

Download Git for your computer.

Install it with the default settings:

```txt
Next → Next → Next → Install → Finish
```

Then close PowerShell/Terminal and open it again.

Type:

```bash
git --version
```

You should see something like:

```txt
git version 2.45.0
```

If you see a version, Git is installed.

---

# 4. Choose where the project will live

I recommend putting the project on your Desktop.

## Windows

Open PowerShell and type:

```powershell
cd Desktop
```

Press Enter.

If that fails, type:

```powershell
cd $HOME\Desktop
```

Press Enter.

---

## Mac

Open Terminal and type:

```bash
cd Desktop
```

Press Enter.

If that fails, type:

```bash
cd ~/Desktop
```

Press Enter.

---

# 5. Download the project from GitHub

In the terminal, type this command exactly:

```bash
git clone https://github.com/elvisybadbunny-bit/workspace-019ec288-23e1-794b-a048-64316c55a575.git
```

Press Enter.

Wait until it finishes.

You should now have a folder on your Desktop called:

```txt
workspace-019ec288-23e1-794b-a048-64316c55a575
```

---

# 6. Enter the project folder

Type:

```bash
cd workspace-019ec288-23e1-794b-a048-64316c55a575
```

Press Enter.

Then type:

```bash
cd neyo
```

Press Enter.

You are now inside the real NEYO app folder.

To confirm, type:

```bash
ls
```

If you are on Windows PowerShell and `ls` does not work, type:

```powershell
dir
```

You should see files like:

```txt
package.json
prisma
src
public
```

If you see those, you are in the right place.

---

# 7. Install the project packages

Inside the `neyo` folder, type:

```bash
npm install
```

Press Enter.

This may take several minutes.

Do not close the terminal.

It is okay if you see warnings. Warnings are not always errors.

You only stop if it clearly says:

```txt
ERROR
```

or:

```txt
failed
```

---

# 8. Create the `.env` file

This is very important.

The `.env` file is where local settings live.

## 8.1 Create the file on Windows

Make sure you are inside the `neyo` folder.

Type this:

```powershell
notepad .env
```

Press Enter.

Notepad will open.

If it asks:

```txt
Do you want to create a new file?
```

Click:

```txt
Yes
```

---

## 8.2 Create the file on Mac

Make sure you are inside the `neyo` folder.

Type:

```bash
touch .env
open -e .env
```

Press Enter.

TextEdit will open.

---

## 8.3 Generate your secret key

Open another terminal window, or use the same one after saving later.

Type:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Press Enter.

It will print something like:

```txt
Qx7Z23abcD9xxxExampleKeyHere123456789=
```

Copy that value.

---

## 8.4 Paste this into `.env`

Paste this into Notepad/TextEdit:

```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="http://localhost:3000"
ROOT_DOMAIN="neyo.co.ke"
NEYO_MASTER_KEK="PASTE_YOUR_RANDOM_KEY_HERE"
DARAJA_WEBHOOK_TOKEN="dev-webhook-token"
CRON_SECRET="dev-cron-secret"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:3000"
```

Now replace:

```txt
PASTE_YOUR_RANDOM_KEY_HERE
```

with the random key you copied.

Example:

```env
NEYO_MASTER_KEK="Qx7Z23abcD9xxxExampleKeyHere123456789="
```

Save the file.

## Windows save

Press:

```txt
Ctrl + S
```

Then close Notepad.

## Mac save

Press:

```txt
Command + S
```

Then close TextEdit.

---

# 9. Prepare the database

Now return to the terminal inside the `neyo` folder.

Run these commands one by one.

## Command 1

```bash
npm run prisma:generate
```

Wait until it finishes.

You want to see something like:

```txt
Generated Prisma Client
```

---

## Command 2

```bash
npm run migrate:deploy
```

Wait until it finishes.

You want to see something like:

```txt
All migrations have been successfully applied
```

---

## Command 3

```bash
npm run db:seed
```

Wait until it finishes.

This adds demo data.

You should see many lines like:

```txt
Seeded Karibu High School
Seeded B.1 students
Seeded G.11 public landing site
```

---

# 10. Start NEYO

In the same terminal, type:

```bash
npm run dev
```

Press Enter.

You should see something like:

```txt
Local: http://localhost:3000
```

Important:

```txt
Do not close this terminal.
```

This terminal is now the engine running NEYO.

If you close it, NEYO stops.

---

# 11. Open NEYO in your browser

Open Chrome, Edge, or Safari.

Type this in the browser address bar:

```txt
http://localhost:3000/login?tenant=karibu-high
```

Press Enter.

You should see the NEYO login page.

---

# 12. Login accounts you can use

## Principal

Use this first:

```txt
Email: principal@karibuhigh.ac.ke
Password: Karibu2026!
```

This account can see most of the school system.

---

## Bursar

```txt
Email: bursar@karibuhigh.ac.ke
Password: Karibu2026!
```

Use this for finance, fees, expenses, inventory.

---

## Teacher

```txt
Email: f.chebet@karibuhigh.ac.ke
Password: Karibu2026!
```

Use this for teacher portal, attendance, homework.

---

## Receptionist

```txt
Email: frontoffice@karibuhigh.ac.ke
Password: Karibu2026!
```

Use this for front desk and print station.

---

## Parent

```txt
Email: parent@karibuhigh.ac.ke
Password: Karibu2026!
```

Use this for parent portal.

---

## Student

```txt
Email: achieng@karibuhigh.ac.ke
Password: Karibu2026!
```

Use this for student portal.

---

## NEYO Super Admin

```txt
Email: support@neyo.co.ke
Password: Karibu2026!
```

Use this for NEYO company/admin features.

Founder Operations will use this kind of access.

---

# 13. What pages to open first

## Public school website

Open:

```txt
http://localhost:3000/?tenant=karibu-high
```

This shows the public Karibu High website.

---

## Login

Open:

```txt
http://localhost:3000/login?tenant=karibu-high
```

---

## Dashboard

After logging in, open:

```txt
http://localhost:3000/dashboard?tenant=karibu-high
```

---

## Public website editor

Login as principal, then open:

```txt
http://localhost:3000/settings/public-site?tenant=karibu-high
```

Test:

1. Change the headline.
2. Click **Save story**.
3. Click **Preview**.
4. Confirm the public website changed.

---

## Students page

Open:

```txt
http://localhost:3000/students?tenant=karibu-high
```

Test:

1. Search for `Achieng`.
2. Click the student.
3. View the profile.

---

## Finance page

Open:

```txt
http://localhost:3000/finance?tenant=karibu-high
```

Test:

1. View invoices.
2. Check balances.
3. Do not enter real money unless you are okay changing demo data.

---

## Attendance page

Login as teacher:

```txt
f.chebet@karibuhigh.ac.ke
Karibu2026!
```

Open:

```txt
http://localhost:3000/attendance?tenant=karibu-high
```

Test:

1. Open register.
2. Mark a learner Present/Late/Absent.
3. Click save.

---

## Parent portal

Login as parent:

```txt
parent@karibuhigh.ac.ke
Karibu2026!
```

Open:

```txt
http://localhost:3000/portal?tenant=karibu-high
```

Test:

1. Click the child.
2. View fees.
3. View attendance.
4. View results.
5. View homework.

---

# 14. If something goes wrong

## Problem: `npm` is not recognized

This means Node.js is not installed correctly.

Fix:

1. Install Node.js from `https://nodejs.org`.
2. Close terminal.
3. Open terminal again.
4. Try:

```bash
node -v
npm -v
```

---

## Problem: `git` is not recognized

This means Git is not installed correctly.

Fix:

1. Install Git from `https://git-scm.com/downloads`.
2. Close terminal.
3. Open terminal again.
4. Try:

```bash
git --version
```

---

## Problem: port 3000 is already in use

You may already have NEYO running in another terminal.

Find the old terminal and press:

```txt
Ctrl + C
```

Then run again:

```bash
npm run dev
```

If Next.js uses another port like `3001`, open:

```txt
http://localhost:3001/login?tenant=karibu-high
```

---

## Problem: the page is blank or weird after build

Stop the dev server:

```txt
Ctrl + C
```

Then run:

```bash
rm -rf .next
npm run dev
```

On Windows PowerShell, use:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

---

# 15. How to reset demo data

If you click many things and want to start fresh:

Stop NEYO first:

```txt
Ctrl + C
```

Then run:

## Mac/Linux

```bash
rm prisma/dev.db
npm run migrate:deploy
npm run db:seed
npm run dev
```

## Windows PowerShell

```powershell
Remove-Item prisma/dev.db
npm run migrate:deploy
npm run db:seed
npm run dev
```

Then open:

```txt
http://localhost:3000/login?tenant=karibu-high
```

---

# 16. How to push your project to GitHub safely

Before pushing, check if `.env` is accidentally included.

Run:

```bash
git status
```

If you see `.env`, stop and ask for help.

You should not push `.env`.

To push normal code changes:

```bash
git add .
git commit -m "Continue NEYO build"
git push
```

---

# 17. Make the GitHub repo private

Do this on GitHub:

1. Open your repo.
2. Click **Settings**.
3. Scroll down to **Danger Zone**.
4. Click **Change repository visibility**.
5. Choose **Private**.

This is important because NEYO is your product.

---

# 18. Simple daily routine

Every time you want to work on NEYO locally:

1. Open terminal.
2. Go to the project:

```bash
cd Desktop
cd workspace-019ec288-23e1-794b-a048-64316c55a575
cd neyo
```

3. Start app:

```bash
npm run dev
```

4. Open browser:

```txt
http://localhost:3000/login?tenant=karibu-high
```

5. Login and test.

---

# 19. What to tell the Build Partner if you get stuck

Copy and send:

1. What command you typed.
2. What error appeared.
3. A screenshot if possible.
4. Your computer type: Windows or Mac.

Example:

```txt
I am on Windows.
I typed npm install.
It says npm is not recognized.
```

Then the Build Partner can guide you exactly.
