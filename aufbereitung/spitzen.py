"""Leistungsspitzen am Allgemeinzähler: Viertelstunden mit mehr als 10 kW Netzbezug (Mittel der Viertelstunde).

Ergebnis: simulation/ausgabe/spitzen_ueber_10kw.md
Aufruf:  python3 aufbereitung/spitzen.py
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
GRENZE = 10.0
MON = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
TAG = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
de = lambda x, nk=1: f"{x:,.{nk}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main():
    df = pd.concat([pd.read_csv(f, sep=";", decimal=",", index_col=0, parse_dates=True)
                    for f in sorted((ROOT / "aufbereitung" / "ausgabe").glob("viertelstunden_*.csv"))])
    kw = df[["bezug_allg", "verbrauch_allg", "wp", "heizpatrone", "pv"]] * 4
    kw["grundlast"] = df["grundlast_allg"] * 4
    kw["aussen"] = df["aussen"]
    s = kw[kw["bezug_allg"] > GRENZE]
    L = ["# Leistungsspitzen Allgemeinstrom über 10 kW", "",
         "Netzbezug am Allgemeinzähler, Mittelwert je Viertelstunde (so misst und verrechnet der Netzbetreiber). "
         "Uhrzeit = Beginn der Viertelstunde. 2026 nur Jänner bis August.", "",
         "## Überblick", "", "| Jahr | Viertelstunden | Tage | höchster Wert | Ø Außentemperatur dabei | Wärmepumpe lief | Ø Wärmepumpe | Ø übriger Allgemeinstrom |",
         "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for y, g in s.groupby(s.index.year):
        L.append(f"| {y} | {len(g)} | {g.index.normalize().nunique()} | {de(g.bezug_allg.max())} kW | {de(g.aussen.mean())} °C | "
                 f"{de((g.wp > 2).mean() * 100, 0)} % | {de(g.wp.mean())} kW | {de((g.verbrauch_allg - g.wp - g.heizpatrone).mean())} kW |")
    L += ["", "## Nach Monat (Zahl der Viertelstunden)", "", "| Jahr | " + " | ".join(MON) + " |", "|---|" + "---:|" * 12]
    for y, g in s.groupby(s.index.year):
        n = g.groupby(g.index.month).size()
        L.append(f"| {y} | " + " | ".join(str(n.get(m, "")) for m in range(1, 13)) + " |")
    L += ["", "## Nach Uhrzeit (Zahl der Viertelstunden, alle Jahre)", "", "| Uhr | " + " | ".join(str(h) for h in range(24)) + " |",
          "|---|" + "---:|" * 24]
    n = s.groupby(s.index.hour).size()
    L.append("| Anzahl | " + " | ".join(str(n.get(h, 0)) for h in range(24)) + " |")
    for y, g in s.groupby(s.index.year):
        L += ["", f"## Alle Tage {y}", "", "| Datum | Viertelstunden | Uhrzeiten (Beginn) | höchster Wert | Außentemperatur (Tag) |", "|---|---:|---|---:|---:|"]
        for d, t in g.groupby(g.index.normalize()):
            zeiten = ", ".join(f"{z:%H:%M}" for z in t.index)
            tag_aussen = kw.loc[d:d + pd.Timedelta("1D") - pd.Timedelta("15min"), "aussen"].mean()
            L.append(f"| {TAG[d.weekday()]} {d:%d.%m.%Y} | {len(t)} | {zeiten} | {de(t.bezug_allg.max())} kW | {de(tag_aussen)} °C |")
    ziel = ROOT / "simulation" / "ausgabe" / "spitzen_ueber_10kw.md"
    ziel.write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L[:40]))


if __name__ == "__main__":
    main()
