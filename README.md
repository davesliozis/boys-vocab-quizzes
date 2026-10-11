# Word Quest

A colorful, accessible vocabulary quiz website for the boys, using all 18 units from each of the third- and fifth-grade workbooks (396 words).

- Choose one or multiple units, or all units.
- Five question styles: meanings, word selection, synonym clues, typed spelling, and sentence completion.
- Choose 10, 20, 30, or every selected word. Short quizzes sample across selected units.
- Immediate answer feedback, final scores, word review, and practice of missed words.
- Mobile layout, keyboard navigation, visible focus, and reduced-motion support.
- Workbook, unit, and quiz preferences are stored on this device. No account, analytics, or server required.

## Run locally

Open `index.html` directly in a browser, or serve this folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Host with GitHub Pages

Upload this folder's files to a GitHub repository. In **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/ (root)**, then save. All asset paths are relative so the site works under a repository URL.

## Validate

```sh
node --test tests/core.test.cjs
```

No build step or installation is needed. `data.js` contains the vocabulary transcribed from the user-provided workbook pages. Preserve that content's attribution and use it according to your workbook license.
