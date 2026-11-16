# Auf GitHub pushen

Ersetze `DEIN-NAME` und `REPO-NAME`. Du brauchst Git auf dem Rechner.

## 1. Repo auf github.com anlegen
Neues, leeres Repository erstellen (ohne README/License ankreuzen), z. B.
`fischer-begleiter`.

## 2. Im Ordner mit diesen Dateien im Terminal

```bash
git init
git add .
git commit -m "Fischer-Begleiter: Kanton SO, Auto-Update der Regeln"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/REPO-NAME.git
git push -u origin main
```

## 3. GitHub Pages einschalten
Im Repo: **Settings → Pages → Branch `main`, Ordner `/ (root)` → Save.**
Nach ein paar Minuten läuft die App unter
`https://DEIN-NAME.github.io/REPO-NAME/`.

## Später etwas ändern

```bash
git add .
git commit -m "Regeln aktualisiert"
git push
```
