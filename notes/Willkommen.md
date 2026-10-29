---
title: Willkommen
date: 2026-10-29
tags: [Anleitung]
---

Neue Einträge sind einfache Markdown-Dateien im Ordner `notes/`. Nach dem Hochladen zu GitHub erscheinen sie nach etwa einer Minute automatisch auf der Seite.

## Ordner

Jeder Unterordner in `notes/` wird zu einem Ordner auf der Website. Mit einer Zahl am Anfang legst du die Reihenfolge fest: `01-Grundlagen` erscheint als „Grundlagen“.

## Downloads

Dateien neben den Eintrag legen und im Kopfbereich der `.md`-Datei auflisten:

```yaml
---
title: Mein Eintrag
downloads:
  - arbeitsblatt.pdf
---
```

## Entwürfe

Dateien und Ordner, deren Name mit `_` beginnt, bleiben unsichtbar.
