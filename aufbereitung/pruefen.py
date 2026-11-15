"""Etappe 1 – Kontrollen K1–K7 (+ Zusatzprüfungen) und Auswertung des Ist-Zustands.

Liest die Ausgabe von einlesen.py und schreibt:
  aufbereitung/ausgabe/pruefbericht.md      alle Kontrollen mit Ergebnis
  aufbereitung/ausgabe/istzustand_<jahr>.md  Ist-Zustand des Referenzjahres in Zahlen

Aufruf:  python3 aufbereitung/pruefen.py            (Referenzjahr aus einstellungen.json)
         python3 aufbereitung/pruefen.py 2024       (anderes Jahr)
Rückgabewert 1, wenn eine harte Kontrolle fehlschlägt.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "einstellungen.json").read_text(encoding="utf-8"))
AUSGABE = ROOT / "aufbereitung" / "ausgabe"
TOPS = CFG["haus"]["tops"]
UST = 1 + CFG["preise"]["ust_prozent"] / 100


def lade(jahre):
    teile = [pd.read_csv(AUSGABE / f"viertelstunden_{j}.csv", sep=";", decimal=",", index_col=0, parse_dates=True)
             for j in jahre]
    return pd.concat(teile).sort_index()


def de(x, nk=0):
    """Zahl im österreichischen Format: 12.345,6"""
    s = f"{x:+,.{nk}f}" if nk >= 3 and abs(x) < 10 else f"{x:,.{nk}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


class Bericht:
    def __init__(self):
        self.zeilen, self.fehler = [], 0

    def kontrolle(self, nr, titel, ok, details, hart=True):
        symbol = "✅" if ok else ("❌" if hart else "⚠️")
        if not ok and hart:
            self.fehler += 1
        self.zeilen.append(f"### {symbol} {nr} – {titel}\n\n{details}\n")

    def text(self, t):
        self.zeilen.append(t)


# --------------------------------------------------------------------------- Kontrollen
def kontrollen(df, b):
    jahre = sorted(set(df.index.year))
    alle_e = [f"e_{t}" for t in TOPS]

    # K1 – Jahressummen gegen Rechnungen HALLAG
    zeilen, ok = ["| Jahr | Größe | Rechnung | Daten | Abweichung |", "|---|---|---:|---:|---:|"], True
    for jahr, soll in CFG["kontrollwerte_rechnungen"].items():
        teil = df[df.index.year == int(jahr)]
        for name, spalte, key in (("Netzbezug Allgemein", "bezug_allg", "bezug_allgemein_kwh"),
                                  ("Einspeisung", "einspeisung", "einspeisung_kwh")):
            ist, s = teil[spalte].sum(), soll[key]
            abw = (ist / s - 1) * 100
            ok &= abs(abw) <= 0.1
            zeilen.append(f"| {jahr} | {name} | {de(s, 2)} kWh | {de(ist, 2)} kWh | {de(abw, 3)} % |")
    b.kontrolle("K1", "Jahressummen = Rechnungen HALLAG (±0,1 %)", ok, "\n".join(zeilen))

    # K2 – Summe der Viertelstunden = Differenz der Tages-Zählerstände
    zs = pd.read_csv(AUSGABE / "zaehlerstaende.csv", sep=";", decimal=",", parse_dates=["zeit_ende"])
    a, e = zs.iloc[0], zs.iloc[-1]
    teil = df[(df.index >= a["zeit_ende"]) & (df.index < e["zeit_ende"])]
    zeilen, ok = [], True
    for name, spalte, zsp in (("Netzbezug", "bezug_allg", "zs_bezug"), ("Einspeisung", "einspeisung", "zs_einspeisung")):
        diff, summe = e[zsp] - a[zsp], teil[spalte].sum()
        abw = (summe / diff - 1) * 100
        ok &= abs(abw) <= 0.1
        zeilen.append(f"- {name}: Zählerstände {a['zeit_ende']:%d.%m.%Y} → {e['zeit_ende']:%d.%m.%Y}: "
                      f"{de(diff, 2)} kWh · Summe Viertelstunden: {de(summe, 2)} kWh · {de(abw, 3)} %")
    b.kontrolle("K2", "Viertelstunden = Tages-Zählerstände (±0,1 %)", ok, "\n".join(zeilen))

    # K3 – EDA-Erzeugung = Einspeisung Allgemeinzähler
    m = df["eda_G"].notna()
    d = (df.loc[m, "eda_G"] - df.loc[m, "einspeisung"]).abs()
    b.kontrolle("K3", "EDA-Erzeugung = Einspeisung Zähler, je Viertelstunde (±1 Wh)", (d > 0.001).sum() == 0,
                f"{de(m.sum())} Viertelstunden verglichen, Abweichungen > 1 Wh: {(d > 0.001).sum()}, "
                f"größte: {de(d.max() * 1000, 1)} Wh")

    # K4 – EDA: Erzeugung = Σ Eigendeckung + Restüberschuss
    d = (df.loc[m, "eda_G"] - df.loc[m, alle_e].fillna(0).sum(axis=1) - df.loc[m, "eda_R"]).abs()
    b.kontrolle("K4", "EDA: Erzeugung = Σ Eigendeckung + Restüberschuss (±5 Wh)", (d > 0.005).sum() == 0,
                f"Abweichungen > 5 Wh: {(d > 0.005).sum()}, größte: {de(d.max() * 1000, 1)} Wh "
                "(die Erzeugung wird von der HALLAG auf 0,01 kWh gerundet geliefert, daher ±5 Wh Toleranz)")

    # K5 – statische Verteilung nachrechnen: Eigendeckung = min(Anteil, Verbrauch lt. Teilnahmefaktor)
    abw, n = 0, 0
    for t in TOPS:
        mm = df[f"a_{t}"].notna()
        x = np.minimum(df.loc[mm, f"a_{t}"], df.loc[mm, f"vt_{t}"])
        abw += ((x - df.loc[mm, f"e_{t}"]).abs() > 0.002).sum()
        n += mm.sum()
    b.kontrolle("K5", "Statische Verteilung nachgerechnet = EDA-Eigendeckung (±2 Wh)", abw == 0,
                f"{de(n)} Werte (Viertelstunde × Top) verglichen, Abweichungen: {abw}")

    # K5b – Schlüssel: Anteil / Erzeugung ist in jeder Viertelstunde konstant
    zeilen = ["| Top | Schlüssel lt. Einstellungen | gemessen (Median) | Streuung |", "|---|---:|---:|---:|"]
    ok = True
    mm = (df["eda_G"] > 0.5) & (df.index >= "2024-12-28")
    for t in TOPS:
        q = (df.loc[mm, f"a_{t}"] / df.loc[mm, "eda_G"]) * 100
        soll = CFG["haus"]["schluessel_hallag_prozent"][str(t)]
        ok &= abs(q.median() - soll) < 0.05
        zeilen.append(f"| {t} | {de(soll, 4)} % | {de(q.median(), 4)} % | {de(q.quantile(0.99) - q.quantile(0.01), 3)} %-Pkt |")
    b.kontrolle("K5b", "Fixer Schlüssel der HALLAG ist konstant und entspricht den Einstellungen", ok,
                "Ab 28.12.2024 (Top 10 dabei), Viertelstunden mit > 0,5 kWh Erzeugung.\n\n" + "\n".join(zeilen))

    # K6 – Allgemeinverbrauch plausibel
    grenze = CFG["haus"]["netzbereitstellung_kw"]["allgemein"] / 4
    neg, hoch = (df["verbrauch_allg"] < -1e-9).sum(), (df["verbrauch_allg"] > grenze).sum()
    korr = df["pv_korrektur"]
    b.kontrolle("K6", "Allgemeinverbrauch nie negativ und nie über Netzbereitstellung (25 kW)",
                neg == 0 and hoch == 0,
                f"negativ: {neg}, über {de(grenze, 2)} kWh/Viertelstunde: {hoch}, Maximum {de(df['verbrauch_allg'].max(), 2)} kWh "
                f"(= {de(df['verbrauch_allg'].max() * 4, 1)} kW).\n\n"
                f"Wo Smartfox-PV und Zähler nicht zusammenpassten, wurde die PV minimal angehoben: "
                f"{(korr > 0).sum()} Viertelstunden, zusammen {de(korr.sum(), 1)} kWh "
                f"({de(korr.sum() / df['pv'].sum() * 100, 3)} % der PV-Erzeugung).")

    # K6b – Heizpatrone bekommt nur PV-Strom
    gm = df["sf_status"] == "gemessen"
    ueber = (df.loc[gm, "heizpatrone"] > df.loc[gm, "pv"] + 0.01)
    b.kontrolle("K6b", "Heizpatrone läuft nur mit PV-Strom", ueber.sum() <= 0.001 * gm.sum(),
                f"Viertelstunden mit Heizpatrone > PV: {ueber.sum()} von {de(gm.sum())} "
                f"({de(df.loc[gm][ueber]['heizpatrone'].sum(), 1)} kWh).", hart=False)

    # K7 – Smartfox-Netzmessung vs. Zähler je Monat (Info)
    zeilen = ["| Monat | Bezug Zähler | Bezug Smartfox | Abw. | Einsp. Zähler | Einsp. Smartfox | Abw. |",
              "|---|---:|---:|---:|---:|---:|---:|"]
    schlecht = 0
    for mon, t in df[gm].groupby(df[gm].index.to_period("M")):
        bz, bs = t["bezug_allg"].sum(), t["sf_netz_bezug"].sum()
        ez, es = t["einspeisung"].sum(), t["sf_netz_einsp"].sum()
        a1 = (bs / bz - 1) * 100 if bz else 0
        a2 = (es / ez - 1) * 100 if ez > 100 else 0
        schlecht += abs(a1) > 5 or abs(a2) > 5
        zeilen.append(f"| {mon} | {de(bz)} | {de(bs)} | {de(a1, 1)} % | {de(ez)} | {de(es)} | {de(a2, 1)} % |")
    b.kontrolle("K7", "Smartfox-Netzmessung passt zum Zähler (±5 % je Monat, nur Info)", schlecht == 0,
                "Für Netzbezug und Einspeisung werden immer die Zählerwerte verwendet; der Smartfox liefert nur "
                "PV und Heizpatrone. Diese Tabelle zeigt, wie genau der Smartfox misst.\n\n"
                f"Monate mit > 5 % Abweichung (Einspeisung nur ab 100 kWh/Monat): {schlecht}\n\n"
                + "\n".join(zeilen), hart=False)

    # Datenlage
    st = df["sf_status"].value_counts()
    luecken = df[df["sf_status"] == "geschaetzt"]
    tage = luecken.groupby(luecken.index.date).size()
    tage = tage[tage >= 8]
    b.kontrolle("D1", "Datenlage Smartfox", True,
                f"Gemessen: {de(st.get('gemessen', 0))} Viertelstunden, geschätzt: {de(st.get('geschaetzt', 0))} "
                f"({de(st.get('geschaetzt', 0) / len(df) * 100, 2)} %).\n\n"
                "Tage mit ≥ 2 h Lücke (PV aus Zählerwerten + typischem Allgemeinverbrauch geschätzt): "
                + ", ".join(f"{d:%d.%m.%Y} ({de(n / 4, 1)} h)" for d, n in tage.items()))
    erg = df[df["allg_status"] == "ergaenzt"]
    b.kontrolle("D2", "Datenlage Allgemeinzähler", True,
                f"Im Export fehlt jeweils die letzte Viertelstunde des Monats ({len(erg)} Werte). "
                "Einspeisung/Restüberschuss aus EDA übernommen, Netzbezug aus den Nachbarwerten interpoliert "
                f"(zusammen {de(erg['bezug_allg'].sum(), 1)} kWh).")


# --------------------------------------------------------------------------- Ist-Zustand
def preis_top(index):
    """Bezugspreis Top in €/kWh brutto je Viertelstunde (SNAP-Fenster berücksichtigt)"""
    p = CFG["preise"]
    snap = index.month.isin(p["snap_monate"]) & (index.hour >= p["snap_stunden"][0]) & (index.hour < p["snap_stunden"][1])
    return np.where(snap, p["bezug_top_snap_ct_netto"], p["bezug_top_ct_netto"]) * UST / 100


def istzustand(df, jahr):
    t = df[df.index.year == jahr]
    p = CFG["preise"]
    s = t.sum(numeric_only=True)
    v = sum(s[f"v_{i}"] for i in TOPS)
    vt = sum(s[f"vt_{i}"] for i in TOPS)
    a = sum(s[f"a_{i}"] for i in TOPS)
    e = sum(s[f"e_{i}"] for i in TOPS)
    pv, hp, allg = s["pv"], s["heizpatrone"], s["verbrauch_allg"]
    allg_pv = allg - s["bezug_allg"]
    haus_verbrauch = allg + hp + v
    haus_pv = allg_pv + hp + e
    pct = lambda x, y: f"{x / y * 100:.0f} %" if y else "–"

    L = [f"# Ist-Zustand {jahr}", "",
         f"Quelle: aufbereitete Messdaten (Zähler HALLAG, EDA, Smartfox). Erstellt von `aufbereitung/pruefen.py`.",
         f"Preise brutto, Stand Rechnungen 2025/2026 (für alle Jahre gleich angesetzt).", "",
         "## Wohin geht der Sonnenstrom?", "",
         "| | kWh | Anteil an PV |", "|---|---:|---:|",
         f"| **PV-Erzeugung** | **{de(pv)}** | 100 % |",
         f"| → direkt im Allgemeinstrom (Wärmepumpe, Grundlast) | {de(allg_pv)} | {pct(allg_pv, pv)} |",
         f"| → Heizpatrone | {de(hp)} | {pct(hp, pv)} |",
         f"| → Überschuss an die Gemeinschaft (Einspeisung Allgemeinzähler) | {de(s['einspeisung'])} | {pct(s['einspeisung'], pv)} |",
         f"| &nbsp;&nbsp;&nbsp;→ davon von den Tops genutzt | {de(e)} | {pct(e, pv)} |",
         f"| &nbsp;&nbsp;&nbsp;→ davon Restüberschuss ins Netz | {de(s['rest'])} | {pct(s['rest'], pv)} |",
         "", "## Woher kommt der Strom?", "",
         "| | Verbrauch kWh | aus PV | aus dem Netz | PV-Anteil |", "|---|---:|---:|---:|---:|",
         f"| Allgemeinstrom (ohne Heizpatrone) | {de(allg)} | {de(allg_pv)} | {de(s['bezug_allg'])} | {pct(allg_pv, allg)} |",
         f"| &nbsp;&nbsp;&nbsp;davon Wärmepumpe | {de(s['wp'])} | | | |",
         f"| &nbsp;&nbsp;&nbsp;davon Grundlast (Lift, Licht, Lüftung, Pumpen …) | {de(s['grundlast_allg'])} | | | |",
         f"| Heizpatrone | {de(hp)} | {de(hp)} | 0 | 100 % |",
         f"| Tops 1–10 | {de(v)} | {de(e)} | {de(v - e)} | {pct(e, v)} |",
         f"| **Haus gesamt** | **{de(haus_verbrauch)}** | **{de(haus_pv)}** | **{de(s['bezug_allg'] + v - e)}** | **{pct(haus_pv, haus_verbrauch)}** |",
         "", f"Top 10 nimmt mit Teilnahmefaktor teil: von {de(v)} kWh Verbrauch der Tops zählen {de(vt)} kWh für die Verteilung.",
         ""]

    # Monatsübersicht
    L += ["## Monate", "",
          "| Monat | PV | Heizpatrone | Wärmepumpe | Grundlast | Netzbezug Allg. | Überschuss | von Tops genutzt | Restüberschuss | Ø Temp. Puffer |",
          "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for mon, m in t.groupby(t.index.month):
        sm = m.sum(numeric_only=True)
        em = sum(sm[f"e_{i}"] for i in TOPS)
        L.append(f"| {mon:02d} | {de(sm['pv'])} | {de(sm['heizpatrone'])} | {de(sm['wp'])} | {de(sm['grundlast_allg'])} | "
                 f"{de(sm['bezug_allg'])} | {de(sm['einspeisung'])} | {de(em)} | {de(sm['rest'])} | {de(m['temp_mittel'].mean(), 1)} °C |")

    # Tops
    pt = preis_top(t.index)
    L += ["", "## Tops", "",
          "| Top | Verbrauch | zählt für Verteilung | zugeteilt | genutzt | Nutzung des Anteils | PV-Anteil am Verbrauch | Ersparnis (brutto) |",
          "|---|---:|---:|---:|---:|---:|---:|---:|"]
    ers_ges = 0
    for i in TOPS:
        ers = (t[f"e_{i}"].fillna(0) * pt).sum()
        ers_ges += ers
        L.append(f"| {i} | {de(s[f'v_{i}'])} | {de(s[f'vt_{i}'])} | {de(s[f'a_{i}'])} | {de(s[f'e_{i}'])} | "
                 f"{pct(s[f'e_{i}'], s[f'a_{i}'])} | {pct(s[f'e_{i}'], s[f'v_{i}'])} | {de(ers)} € |")
    L.append(f"| **Σ** | **{de(v)}** | **{de(vt)}** | **{de(a)}** | **{de(e)}** | **{pct(e, a)}** | **{pct(e, v)}** | **{de(ers_ges)} €** |")

    # Geld
    eins = np.array([p["einspeisung_ct_monat_2025"][str(mo)] for mo in t.index.month]) / 100
    verg_ist = (t["einspeisung"] * eins).sum()
    verg_rest = (t["rest"] * eins).sum()
    kosten_allg = s["bezug_allg"] * p["bezug_allgemein_ct_netto"] * UST / 100
    L += ["", "## Geld (arbeitsabhängige Anteile, ohne Grund- und Messpreise)", "",
          "| | € brutto |", "|---|---:|",
          f"| Netzbezug Allgemeinstrom ({de(s['bezug_allg'])} kWh × {de(p['bezug_allgemein_ct_netto'] * UST, 2)} ct) | {de(kosten_allg)} € |",
          f"| Ersparnis der Tops durch PV-Zuteilung | {de(ers_ges)} € |",
          f"| Einspeisevergütung, wie die HALLAG derzeit abrechnet (gesamte Einspeisung) | {de(verg_ist)} € |",
          f"| Einspeisevergütung, regulär (nur Restüberschuss) | {de(verg_rest)} € |",
          "",
          "Hinweis: Die HALLAG vergütet derzeit die **gesamte** Einspeisung, obwohl ein Teil davon den Tops zugeteilt "
          "wird. Für die Simulation wird die reguläre Variante (nur Restüberschuss) verwendet – bitte mit der HALLAG klären."]
    return "\n".join(L) + "\n"


def main():
    jahr = int(sys.argv[1]) if len(sys.argv) > 1 else CFG["daten"]["referenzjahr"]
    jahre = sorted(int(p.stem.split("_")[1]) for p in AUSGABE.glob("viertelstunden_*.csv"))
    df = lade(jahre)
    b = Bericht()
    b.text(f"# Prüfbericht Datenaufbereitung\n\nZeitraum: {df.index.min():%d.%m.%Y} – {df.index.max():%d.%m.%Y %H:%M} "
           f"· {de(len(df))} Viertelstunden\n\n✅ bestanden · ⚠️ Hinweis · ❌ nicht bestanden\n")
    kontrollen(df, b)
    status = "**Alle harten Kontrollen bestanden.**" if b.fehler == 0 else f"**{b.fehler} harte Kontrolle(n) NICHT bestanden.**"
    b.zeilen.insert(1, status + "\n")
    (AUSGABE / "pruefbericht.md").write_text("\n".join(b.zeilen), encoding="utf-8")
    (AUSGABE / f"istzustand_{jahr}.md").write_text(istzustand(df, jahr), encoding="utf-8")
    print(status.replace("*", ""))
    print(f"→ {(AUSGABE / 'pruefbericht.md').relative_to(ROOT)}, {(AUSGABE / f'istzustand_{jahr}.md').relative_to(ROOT)}")
    sys.exit(1 if b.fehler else 0)


if __name__ == "__main__":
    main()
