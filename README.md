# Digital Garden

Statische Website für GitHub Pages. Einträge sind Markdown-Dateien in `notes/`.

## Neuer Eintrag

1. `.md`-Datei in `notes/` oder einen Unterordner legen.
2. Committen und pushen. Nach ca. 1 Minute ist sie online.

Optionaler Kopfbereich:

```yaml
---
title: Bruchrechnen
date: 2026-10-29
tags: [Mathe, Klasse 6]
downloads:
  - arbeitsblatt.pdf
---
```

Ohne Kopfbereich gilt: Titel = erste `# Überschrift`, Datum = letzter Commit.

## Ordner

Unterordner in `notes/` erscheinen als Ordner. Zahlenpräfix sortiert und wird ausgeblendet (`01-Algebra` → „Algebra“). Namen mit `_` am Anfang bleiben unsichtbar.

## Downloads

Datei neben die `.md` legen und unter `downloads:` eintragen. Im Text funktionieren auch Links wie `[Blatt](arbeitsblatt.pdf)`. Keine Leerzeichen in Dateinamen verwenden.

## Einrichtung

Repository → Settings → Pages → Source: **GitHub Actions**.

## Lokal ansehen

```
node scripts/build-index.mjs
python3 -m http.server 8000
```
Dann `http://localhost:8000` öffnen.
