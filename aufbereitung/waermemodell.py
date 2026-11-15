"""Viertelstunden-Modell des Pufferspeichers (Fühler in der Mitte) und der Wärmepumpen-Regelung.

1. Energiebilanz am Fühler (Regression je Jahreszeit):
     ΔT = k_wp·WP-Strom + k_hp·Heizpatrone − Wärmeentnahme(Außentemperatur, Einstrahlung, Uhrzeit) − Verluste
   k_hp / k_wp = wie viel WP-Strom 1 kWh Heizpatrone ersetzt (am Fühler gemessen).
2. Wärmeentnahme je Viertelstunde aus den Messwerten rekonstruiert:  D = k_wp·WP + k_hp·HP − ΔT
   (enthält Heizung, Warmwasser, Verluste – so, wie sie tatsächlich aufgetreten sind).
3. Regelung der Wärmepumpe aus den Daten gelernt: Start-/Stopptemperatur am Fühler und Leistung je
   Außentemperatur; Mindestlaufzeit, Mindestpause.
4. Prüfung: Die Regelung steuert 2025 selbst (Heizpatrone wie gemessen) – Strom, Starts, Temperaturen
   müssen zur Messung passen. Danach Varianten (Heizpatrone aus usw.).

Ergebnis: aufbereitung/ausgabe/waermemodell.json (Parameter für den Rechenkern), simulation/ausgabe/waermemodell.md
Aufruf:  python3 aufbereitung/waermemodell.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
AUS = ROOT / "aufbereitung" / "ausgabe"
JAHRESZEIT = {m: ("winter" if m in (11, 12, 1, 2) else "uebergang" if m in (3, 4, 9, 10) else "sommer") for m in range(1, 13)}
A_KLASSEN = [-30, 0, 5, 10, 15, 20, 45]        # Außentemperatur-Klassen für die Regelung
de = lambda x, nk=1: f"{x:,.{nk}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def lade():
    df = pd.concat([pd.read_csv(f, sep=";", decimal=",", index_col=0, parse_dates=True,
                                usecols=["zeit", "wp", "heizpatrone", "temp_mittel", "aussen", "strahlung", "sf_status"])
                    for f in sorted(AUS.glob("viertelstunden_*.csv"))])
    df["dT"] = df["temp_mittel"].shift(-1) - df["temp_mittel"]
    folge = (df.index.to_series().shift(-1) - df.index.to_series()) == pd.Timedelta("15min")
    df["ok"] = (df["sf_status"].eq("gemessen") & df["sf_status"].shift(-1).eq("gemessen") & folge.values
                & df["dT"].notna() & df["aussen"].notna() & df["temp_mittel"].notna())
    df["jz"] = df.index.month.map(JAHRESZEIT)
    return df


def merkmale(d):
    X = pd.DataFrame(index=d.index)
    X["wp"] = d["wp"]; X["hp"] = d["heizpatrone"]
    X["heizgrad"] = np.maximum(0, 15 - d["aussen"]) / 96
    X["sonne"] = d["strahlung"] / 1000 / 4
    X["verlust"] = d["temp_mittel"] - 20
    for h in range(24):
        X[f"h{h}"] = (d.index.hour == h).astype(float)
    return X


def bilanz(df):
    """Regression je Jahreszeit → k_wp, k_hp und übrige Koeffizienten."""
    par = {}
    for jz in ("winter", "uebergang", "sommer"):
        d = df[df["ok"] & (df["jz"] == jz)]
        X = merkmale(d)
        b, *_ = np.linalg.lstsq(X.to_numpy(), d["dT"].to_numpy(), rcond=None)
        r = d["dT"].to_numpy() - X.to_numpy() @ b
        par[jz] = dict(zip(X.columns, b.tolist()))
        par[jz]["r2"] = float(1 - (r @ r) / ((d["dT"] - d["dT"].mean()) ** 2).sum())
    return par


NACHT = (22, 23, 0, 1, 2, 3, 4)
HP_LAEUFT = 0.125        # kWh je Viertelstunde (0,5 kW): Heizpatrone gilt als laufend


def zustand(stunde, hp_vorher):
    """Regel-Zustand: 'hp' = Heizpatrone lief in der Viertelstunde davor, sonst 'nacht' (22–5 Uhr) oder 'tag'."""
    return "hp" if hp_vorher > HP_LAEUFT else ("nacht" if stunde in NACHT else "tag")


def regelung(df):
    """Start-/Stopptemperatur am Fühler und mittlere Leistung im Lauf je Zustand und Außentemperatur-Klasse.

    Der Fühler in der Mitte zeigt bei laufender Heizpatrone deutlich mehr an, wenn die Wärmepumpe startet/stoppt
    (Schichtung bzw. PV-Anhebung) – deshalb eigene Schwellen für „Heizpatrone läuft“; nachts schaltet die Anlage tiefer.
    """
    d = df[df["sf_status"].eq("gemessen")]
    an = d["wp"] * 4 > 2.0
    start, stopp = an & ~an.shift(1, fill_value=False), ~an & an.shift(1, fill_value=False)
    t_vor = d["temp_mittel"].shift(1)
    z = pd.Series([zustand(h, x) for h, x in zip(d.index.hour, d["heizpatrone"].shift(1).fillna(0))], index=d.index)
    kl = pd.cut(d["aussen"], A_KLASSEN)
    out = {}
    for zs in ("tag", "nacht", "hp"):
        tab, vorher = [], None
        for iv in kl.cat.categories:
            m = (kl == iv) & (z == zs)
            n_s, n_a = int((start & m).sum()), int((stopp & m).sum())
            k = {"bis": float(iv.right), "n_start": n_s,
                 "t_ein": float(t_vor[start & m].median()) if n_s >= 20 else None,
                 "t_aus": float(t_vor[stopp & m].median()) if n_a >= 20 else None,
                 "wp_lauf": float(d["wp"][an & m].mean()) if (an & m).sum() >= 20 else None}
            tab.append(k)
        # zu wenige Fälle: Nachbarklasse übernehmen
        for _ in range(len(tab)):
            for i, k in enumerate(tab):
                for f in ("t_ein", "t_aus", "wp_lauf"):
                    if k[f] is None:
                        nb = [tab[j][f] for j in (i - 1, i + 1) if 0 <= j < len(tab) and tab[j][f] is not None]
                        k[f] = nb[0] if nb else None
        out[zs] = tab
    # Zeitprogramm: typische Abweichung der Schaltpunkte je Uhrzeit (ohne Heizpatrone, mind. 50 Fälle)
    kl_e = np.array([klasse({"klassen": out}, zz, a)["t_ein"] if zz != "hp" else np.nan for zz, a in zip(z, d["aussen"])])
    kl_a = np.array([klasse({"klassen": out}, zz, a)["t_aus"] if zz != "hp" else np.nan for zz, a in zip(z, d["aussen"])])
    off = {}
    for name, ereignis, ref in (("ein", start, kl_e), ("aus", stopp, kl_a)):
        r = (t_vor - ref)[ereignis & (z != "hp")].dropna()
        g_h = r.groupby(r.index.hour)
        off[name] = [round(float(g_h.median().get(h, 0)), 2) if g_h.size().get(h, 0) >= 50 else 0.0 for h in range(24)]
    g = (an != an.shift()).cumsum()
    laeufe = an.groupby(g).agg(["first", "size"]); laeufe = laeufe[laeufe["first"]]["size"]
    return {"klassen": out, "min_lauf": int(max(1, laeufe.quantile(0.25))), "min_pause": 1,
            "nacht": list(NACHT), "hp_laeuft_kwh": HP_LAEUFT,
            "stunde_ein": off["ein"], "stunde_aus": off["aus"]}


def klasse(reg, zs, a):
    for k in reg["klassen"][zs]:
        if a <= k["bis"]:
            return k
    return reg["klassen"][zs][-1]


def simuliere(df, par, reg, hp_reihe):
    """Regelung steuert die Wärmepumpe; Wärmeentnahme D wie rekonstruiert. Gibt WP-Strom und Temperatur zurück."""
    n = len(df)
    T = np.empty(n); wp = np.zeros(n)
    t = df["temp_mittel"].dropna().iloc[0]
    an, lauf, pause = False, 0, 99
    jz = df["jz"].to_numpy(); A = df["aussen"].to_numpy(); D = df["D"].to_numpy(); hp = hp_reihe
    H = df.index.hour.to_numpy()
    for i in range(n):
        zs = zustand(H[i], hp[i - 1] if i else 0)
        k = klasse(reg, zs, A[i]); p = par[jz[i]]
        oe, oa = (0, 0) if zs == "hp" else (reg["stunde_ein"][H[i]], reg["stunde_aus"][H[i]])
        if an:
            if t >= k["t_aus"] + oa and lauf >= reg["min_lauf"]:
                an, pause = False, 0
        elif t <= k["t_ein"] + oe and pause >= reg["min_pause"]:
            an, lauf = True, 0
        if an:
            wp[i] = k["wp_lauf"]; lauf += 1
        else:
            pause += 1
        T[i] = t
        t = t + p["wp"] * wp[i] + p["hp"] * hp[i] - D[i]
    return wp, T


def main():
    df = lade()
    df["aussen"] = df["aussen"].ffill().bfill()            # einzelne fehlende Wetterstunden
    par = bilanz(df)
    reg = regelung(df)
    # Wärmeentnahme je Viertelstunde (in Kelvin am Fühler) aus der Messung rekonstruieren
    kwp = df["jz"].map({j: par[j]["wp"] for j in par}); khp = df["jz"].map({j: par[j]["hp"] for j in par})
    df["D"] = (kwp * df["wp"] + khp * df["heizpatrone"] - df["dT"]).where(df["ok"])
    # Lücken (Smartfox fehlt): typische Entnahme gleicher Stunde/Jahreszeit
    typ = df.groupby([df["jz"], df.index.hour])["D"].transform("median")
    df["D"] = df["D"].fillna(typ)

    L = ["# Wärmemodell: Pufferspeicher und Wärmepumpe (Viertelstunden)", "",
         "Fühler in der Mitte des CombiSol (1.350 l). Daten 2024–2026, Wetter GeoSphere Austria.", "",
         "## 1. Energiebilanz am Fühler", "",
         "| Jahreszeit | 1 kWh WP-Strom hebt den Fühler um | 1 kWh Heizpatrone hebt um | **ersetzt WP-Strom** | R² |", "|---|---:|---:|---:|---:|"]
    for jz, name in (("winter", "Winter"), ("uebergang", "Übergang"), ("sommer", "Sommer")):
        p = par[jz]
        L.append(f"| {name} | {de(p['wp'], 2)} K | {de(p['hp'], 2)} K | **{de(p['hp'] / p['wp'], 2)} kWh** | {de(p['r2'], 2)} |")
    L += ["", "„ersetzt WP-Strom“ = so viel Wärmepumpenstrom spart 1 kWh Heizpatrone (am Fühler gemessen).", "",
          "## 2. Gelernte Regelung der Wärmepumpe", "",
          "Start-/Stopptemperatur am Mittelfühler (Median) und Strom im Lauf, je Zustand:", "",
          "| Außentemperatur bis | Tag: Start / Stopp | Nacht (22–5 Uhr): Start / Stopp | Heizpatrone läuft: Start / Stopp | Strom im Lauf (Tag) |",
          "|---|---:|---:|---:|---:|"]
    K = reg["klassen"]
    for i, k in enumerate(K["tag"]):
        z = lambda zs: f"{de(K[zs][i]['t_ein'])} / {de(K[zs][i]['t_aus'])} °C"
        L.append(f"| {de(k['bis'], 0)} °C | {z('tag')} | {z('nacht')} | {z('hp')} | {de(k['wp_lauf'] * 4)} kW |")
    L += ["", "Zeitprogramm (Abweichung der Schaltpunkte je Uhrzeit, ohne Heizpatrone):", "",
          "| Uhr | " + " | ".join(str(h) for h in range(24)) + " |", "|---|" + "---:|" * 24,
          "| Start | " + " | ".join(de(x) for x in reg["stunde_ein"]) + " |",
          "| Stopp | " + " | ".join(de(x) for x in reg["stunde_aus"]) + " |"]
    L += [f"", f"Mindestlaufzeit {reg['min_lauf']} Viertelstunden, Mindestpause {reg['min_pause']} Viertelstunde.", ""]

    # 3. Prüfung 2025: Regelung steuert, Heizpatrone wie gemessen
    j = df[df.index.year == 2025]
    wp_sim, T_sim = simuliere(j, par, reg, j["heizpatrone"].to_numpy())
    wp_mess = j["wp"].to_numpy()
    an_s = wp_sim > 0; an_m = wp_mess * 4 > 2
    starts = lambda a: int((a & ~np.roll(a, 1)).sum())
    pv_stunden = (j.index.hour >= 9) & (j.index.hour < 17)
    mon = pd.DataFrame({"mess": wp_mess, "sim": wp_sim}, index=j.index).resample("ME").sum()
    L += ["## 3. Prüfung: Modell steuert 2025 selbst (Heizpatrone wie gemessen)", "",
          "| | Messung | Modell | Abweichung |", "|---|---:|---:|---:|",
          f"| Wärmepumpenstrom | {de(wp_mess.sum(), 0)} kWh | {de(wp_sim.sum(), 0)} kWh | {de((wp_sim.sum() / wp_mess.sum() - 1) * 100)} % |",
          f"| Starts pro Tag | {de(starts(an_m) / 365)} | {de(starts(an_s) / 365)} | |",
          f"| Anteil WP-Strom 9–17 Uhr | {de(wp_mess[pv_stunden].sum() / wp_mess.sum() * 100, 0)} % | {de(wp_sim[pv_stunden].sum() / wp_sim.sum() * 100, 0)} % | |",
          f"| Fühler Median / 5 % / 95 % | {de(j['temp_mittel'].median())} / {de(j['temp_mittel'].quantile(.05))} / {de(j['temp_mittel'].quantile(.95))} °C | "
          f"{de(np.median(T_sim))} / {de(np.percentile(T_sim, 5))} / {de(np.percentile(T_sim, 95))} °C | |", "",
          "| Monat | Messung | Modell | Abw. |", "|---|---:|---:|---:|"]
    for t, r in mon.iterrows():
        L.append(f"| {t:%m} | {de(r['mess'], 0)} kWh | {de(r['sim'], 0)} kWh | {de((r['sim'] / r['mess'] - 1) * 100)} % |")

    # 4. Variante: Heizpatrone aus
    wp_aus, T_aus = simuliere(j, par, reg, np.zeros(len(j)))
    L += ["", "## 4. Variante: Heizpatrone nur Notheizung (aus)", "",
          "| | Modell, Heizpatrone wie gemessen | Modell, Heizpatrone aus | Unterschied |", "|---|---:|---:|---:|",
          f"| Wärmepumpenstrom | {de(wp_sim.sum(), 0)} kWh | {de(wp_aus.sum(), 0)} kWh | **{de(wp_aus.sum() - wp_sim.sum(), 0)} kWh** |",
          f"| je kWh Heizpatrone (gemessen {de(j['heizpatrone'].sum(), 0)} kWh) | | | {de((wp_aus.sum() - wp_sim.sum()) / j['heizpatrone'].sum(), 2)} kWh |",
          f"| Starts pro Tag | {de(starts(an_s) / 365)} | {de(starts(wp_aus > 0) / 365)} | |",
          f"| Betriebsstunden | {de(an_s.sum() / 4, 0)} h | {de((wp_aus > 0).sum() / 4, 0)} h | {de(((wp_aus > 0).sum() - an_s.sum()) / 4, 0)} h |",
          f"| Anteil WP-Strom 9–17 Uhr | {de(wp_sim[pv_stunden].sum() / wp_sim.sum() * 100, 0)} % | {de(wp_aus[pv_stunden].sum() / wp_aus.sum() * 100, 0)} % | |",
          f"| Fühler Median / 95 % | {de(np.median(T_sim))} / {de(np.percentile(T_sim, 95))} °C | {de(np.median(T_aus))} / {de(np.percentile(T_aus, 95))} °C | |"]
    # Robustheit: Ergebnis „Heizpatrone aus“ bei anderen Regel-Parametern
    L += ["", "## 5. Robustheit", "", "Mehrverbrauch der Wärmepumpe bei „Heizpatrone aus“, wenn die gelernte Regelung verändert wird:", "",
          "| Mindestlauf | Schaltabstand enger um | Starts/Tag (Messung " + de(starts(an_m) / 365) + ") | Mehrverbrauch |", "|---:|---:|---:|---:|"]
    import copy
    for ml, eng in ((1, 0), (1, 2), (2, 0), (3, 0), (3, 2)):
        r = copy.deepcopy(reg); r["min_lauf"] = ml
        for tab in r["klassen"].values():
            for k in tab:
                k["t_ein"] += eng / 2; k["t_aus"] -= eng / 2
        a, _ = simuliere(j, par, r, j["heizpatrone"].to_numpy()); b, _ = simuliere(j, par, r, np.zeros(len(j)))
        L.append(f"| {ml} | {eng} K | {de(starts(a > 0) / 365)} | {de(b.sum() - a.sum(), 0)} kWh |")
    L += ["", "Hinweis: Der Jahresstrom der Wärmepumpe stimmt im Prüflauf fast genau, weil die Wärmeentnahme aus denselben "
          "Messungen rekonstruiert ist – das ist eine Bilanzprobe, keine unabhängige Prüfung. Unabhängig geprüft werden "
          "Zeitpunkte (Anteil 9–17 Uhr), Starts und Temperaturverlauf."]

    # Für den Rechenkern: Wärmeentnahme je Viertelstunde (Milli-Kelvin am Fühler) und Parameter in jahr_<jahr>.json
    modell = {"bilanz": {jz: {"wp": par[jz]["wp"], "hp": par[jz]["hp"]} for jz in par}, "regelung": reg,
              "jahreszeit": {str(m): JAHRESZEIT[m] for m in range(1, 13)}}
    for pfad in sorted((ROOT / "simulation" / "daten").glob("jahr_*.json")):
        d = json.loads(pfad.read_text(encoding="utf-8"))
        x = df[df.index.year == d["jahr"]]
        assert len(x) == len(d["zeit"]) and int(x.index[0].strftime("%Y%m%d%H%M")) == d["zeit"][0], pfad
        d["entnahme"] = np.rint(x["D"].to_numpy() * 1000).astype(int).tolist()
        d["aussen"] = np.rint(x["aussen"].to_numpy() * 10).astype(int).tolist()
        d["temp_start"] = float(x["temp_mittel"].dropna().iloc[0])
        d["waermemodell"] = modell
        pfad.write_text(json.dumps(d, separators=(",", ":")), encoding="utf-8")
    (ROOT / "simulation" / "ausgabe" / "waermemodell.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    (AUS / "waermemodell.json").write_text(json.dumps({"bilanz": par, "regelung": reg}, indent=1), encoding="utf-8")
    print("\n".join(L))


if __name__ == "__main__":
    main()
