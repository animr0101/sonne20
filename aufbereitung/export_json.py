"""Exportiert die Viertelstunden-Tabellen als kompakte JSON-Dateien für den Rechenkern.

Energie in Wh (ganze Zahlen), Temperatur in Zehntelgrad, Zeit als JJJJMMTTHHMM.
Ergebnis: simulation/daten/jahr_<jahr>.json

Aufruf:  python3 aufbereitung/export_json.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "einstellungen.json").read_text(encoding="utf-8"))
AUSGABE = ROOT / "aufbereitung" / "ausgabe"
ZIEL = ROOT / "simulation" / "daten"
TOPS = CFG["haus"]["tops"]

FELDER = {  # Name im JSON: Spalte in der Tabelle
    "einspeisung": "einspeisung", "rest": "rest", "bezug_allg": "bezug_allg", "pv": "pv",
    "heizpatrone": "heizpatrone", "verbrauch_allg": "verbrauch_allg", "wp": "wp", "grundlast_allg": "grundlast_allg",
}


def wh(s):
    return np.rint(s.fillna(0).to_numpy() * 1000).astype(int).tolist()


def eauto_ladung(v):
    """Ladeleistung eines vorhandenen E-Autos aus dem Wohnungsverbrauch herauslösen (kWh je Viertelstunde).

    Ladeviertelstunden: ≥ 0,8 kWh (≥ 3,2 kW), dazu Anlauf/Auslauf ≥ 0,4 kWh direkt daneben.
    E-Auto = Verbrauch − typischer Haushaltsverbrauch derselben Stunde (Median der Viertelstunden < 0,5 kWh).
    Nur zusammenhängende Ladungen mit ≥ 3 kWh zählen.
    """
    lade = v >= 0.8
    sitz = lade.copy()
    for k in (1, -1):
        sitz |= (v >= 0.4) & lade.shift(k, fill_value=False)
    haushalt = v[v < 0.5].groupby(v[v < 0.5].index.hour).median()
    ev = (v - v.index.hour.map(haushalt).fillna(0).to_numpy()).clip(lower=0).where(sitz, 0.0)
    gruppe = (sitz != sitz.shift()).cumsum()
    summe = ev.groupby(gruppe).transform("sum")
    return ev.where(summe >= 3, 0.0)


def main():
    ZIEL.mkdir(parents=True, exist_ok=True)
    for pfad in sorted(AUSGABE.glob("viertelstunden_*.csv")):
        df = pd.read_csv(pfad, sep=";", decimal=",", index_col=0, parse_dates=True)
        jahr = df.index[0].year
        out = {
            "jahr": int(jahr),
            "einheit": "Wh je Viertelstunde",
            "zeit": [int(t.strftime("%Y%m%d%H%M")) for t in df.index],
            "geschaetzt": (df["sf_status"] == "geschaetzt").astype(int).tolist(),
            "temp": np.rint(df["temp_mittel"].fillna(-1) * 10).astype(int).tolist(),
            "aussen": np.rint(df["aussen"].fillna(-999) * 10).astype(int).tolist(),   # Zehntelgrad, -9990 = fehlt
            "strahlung": np.rint(df["strahlung"].fillna(0)).astype(int).tolist(),     # W/m²
        }
        for name, spalte in FELDER.items():
            out[name] = wh(df[spalte])
        for k in ("v", "vt", "e"):
            out[k] = {str(t): wh(df[f"{k}_{t}"]) for t in TOPS}
        # vorhandenes E-Auto in Top 4 (für Kontrolle K10 und Szenario „Top 4 lädt mit PV“)
        out["eauto_ist"] = {"4": wh(eauto_ladung(df["v_4"].fillna(0)))}
        ziel = ZIEL / f"jahr_{jahr}.json"
        ziel.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
        print(f"{ziel.relative_to(ROOT)}: {len(df)} Viertelstunden, {ziel.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
