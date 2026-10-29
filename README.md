# Beantown Hub

A simple scoreboard for Boston's four major pro teams — Red Sox (MLB), Patriots (NFL),
Celtics (NBA), and Bruins (NHL) — all in one place. Use the tabs at the top to see all of
them or filter down to a single team.

## Project structure

```
beantown-hub/
├── index.html       # page structure
├── css/
│   └── style.css    # all styling
├── js/
│   └── app.js        # team + game data, and all app logic
├── package.json      # dev server setup
└── README.md
```

No frameworks, no build step — just HTML, CSS, and JavaScript.

## Running it locally

1. **Install the dev server** (one-time setup). This project uses a tiny tool called
   [`live-server`](https://www.npmjs.com/package/live-server) that serves the app and
   automatically refreshes your browser whenever you save a file. Run:

   ```
   npm install
   ```

   This reads `package.json` and downloads `live-server` into a `node_modules/` folder.
   (Requires [Node.js](https://nodejs.org/) to be installed on your computer — it comes with
   `npm` built in.)

2. **Start the dev server:**

   ```
   npm run dev
   ```

   This runs the `dev` script defined in `package.json`, which starts `live-server` on
   `http://localhost:8080`. It should open automatically in your browser — if not, visit
   that address manually.

3. **Make changes.** Edit `index.html`, `css/style.css`, or `js/app.js` in your editor and
   save. The browser tab will reload automatically to show your changes.

4. **Stop the server** whenever you're done by pressing `Ctrl+C` in the terminal.

## Where the data comes from

The scores in `js/app.js` are hard-coded placeholder data, not a live feed. To show real,
up-to-date scores you'd eventually replace the `games` array with a `fetch()` call to a
sports-data API — that's a good next step once you're comfortable with the basics here.
