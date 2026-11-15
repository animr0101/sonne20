"""Etappe 1 – Rohdaten einlesen und zu einer Viertelstunden-Tabelle zusammenführen.

Quellen:
  Allgemein/                              Netzbezug, Einspeisung, Restüberschuss (Zähler HALLAG)
  EDA/                                    Verbrauch, Teilnahmefaktor, Anteil, Eigendeckung je Top
  Smartfox_Automatisch/1_Tages_Rohdaten/  PV, Heizpatrone, Temperatur, Relais (30 s)

Ergebnis (aufbereitung/ausgabe/):
  viertelstunden_<jahr>.csv   eine Zeile je Viertelstunde, Energie in kWh
  zaehlerstaende.csv          Tages-Zählerstände des Allgemeinzählers (für Kontrolle K2)

Aufruf:  python3 aufbereitung/einlesen.py
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "einstellungen.json").read_text(encoding="utf-8"))
AUSGABE = ROOT / "aufbereitung" / "ausgabe"
TOPS = CFG["haus"]["tops"]
QH = pd.Timedelta(minutes=15)


def zahl(s):
    """'0,35' / '0.35' / '' -> float bzw. NaN"""
    return pd.to_numeric(s.astype(str).str.replace(",", ".", regex=False).str.strip().replace("", np.nan),
                         errors="coerce")


def letzter_sonntag(jahr, monat):
    d = pd.Timestamp(jahr, monat, 31)
    return d - pd.Timedelta(days=(d.weekday() + 1) % 7)


# --------------------------------------------------------------------------- Allgemeinzähler
def lade_allgemein():
    teile, zs = [], []
    for f in sorted((ROOT / CFG["daten"]["allgemein"]).glob("*.csv")):
        df = pd.read_csv(f, sep=";", dtype=str, encoding="utf-8", keep_default_na=False)
        cols = list(df.columns)

        def spalte(muster):
            treffer = [c for c in cols if re.search(muster, c)]
            if len(treffer) != 1:
                raise ValueError(f"{f.name}: Spalte '{muster}' nicht eindeutig: {treffer}")
            return treffer[0]

        c_bez = spalte(r"500A .*Verbrauch \(IME.*Einheit kWh")
        c_bez_zs = spalte(r"500A .*Verbrauch \(IME.*Zählerstand")
        c_ein = spalte(r"500B .*Einspeisung \(IME, 07\.12\.2023.*Einheit kWh")
        c_ein_zs = spalte(r"500B .*Einspeisung \(IME, 07\.12\.2023.*Zählerstand")
        c_rest = spalte(r"500B .*Einspeisung \(IME, 05\.01\.2022.*Einheit kWh")

        von_bis = df["Datum"].str.split(" - ", expand=True)
        t = pd.to_datetime(von_bis[0], format="%d.%m.%Y %H:%M")
        t_ende = pd.to_datetime(von_bis[1], format="%d.%m.%Y %H:%M")
        teile.append(pd.DataFrame({"zeit": t, "bezug_allg": zahl(df[c_bez]),
                                   "einspeisung": zahl(df[c_ein]), "rest": zahl(df[c_rest])}))
        z = pd.DataFrame({"zeit_ende": t_ende, "zs_bezug": zahl(df[c_bez_zs]), "zs_einspeisung": zahl(df[c_ein_zs])})
        zs.append(z.dropna(subset=["zs_bezug"]))
    allg = pd.concat(teile).drop_duplicates("zeit").set_index("zeit").sort_index()
    return allg, pd.concat(zs).sort_values("zeit_ende")


# --------------------------------------------------------------------------- EDA
EDA_CODES = {
    "Gesamtverbrauch lt. Messung (bei Teilnahme gem. Erzeugung)": "v",
    "Verbrauch lt. Messung entsprechend dem Teilnahmefaktor je ZP und EC-ID": "vt",
    "Anteil gemeinschaftliche Erzeugung": "a",
    "Eigendeckung gemeinschaftliche Erzeugung": "e",
    "Gesamte gemeinschaftliche Erzeugung": "G",
    "Restüberschuss bei EG und je ZP": "R",
}


def lade_eda():
    teile = []
    for f in sorted((ROOT / CFG["daten"]["eda"]).glob("*.csv")):
        roh = pd.read_csv(f, sep=";", header=None, dtype=str, encoding="utf-8", keep_default_na=False,
                          encoding_errors="replace")
        meta = {r[0]: r for r in roh.itertuples(index=False) if not re.match(r"\d{2}\.\d{2}\.\d{4}", str(r[0]))}
        ids, codes = meta["MeteringPointId"], meta["MeterCode"]
        daten = roh[roh[0].str.match(r"\d{2}\.\d{2}\.\d{4}")]
        out = {"zeit": pd.to_datetime(daten[0], format="%d.%m.%Y %H:%M")}
        for i in range(1, len(ids) - 1):
            zp = str(ids[i]).strip()
            if not zp.startswith("AT") or str(ids[i + 1]).strip() != "MM":
                continue
            kurz = EDA_CODES.get(str(codes[i]).split(" [")[0].strip())
            if kurz is None:
                continue
            if zp.endswith("500B"):
                out[f"eda_{kurz}"] = zahl(daten[i])
            else:
                top = int(zp[-3:-1])
                out[f"{kurz}_{top}"] = zahl(daten[i])
        teile.append(pd.DataFrame(out))
    eda = pd.concat(teile).set_index("zeit").sort_index()
    eda = eda[~eda.index.duplicated()]
    # Zeilen ohne jeden Wert (Sommerzeit-Lücke im März) entfernen
    return eda.dropna(how="all")


# --------------------------------------------------------------------------- Smartfox
SF_SPALTEN = {"Power": "netz_w", "PvPower": "pv_w", "UsedPower": "hp_w",
              "TemperaturePT1000": "temp", "Relay1": "relais_wp", "Relay0": "relais_lueftung"}


def lade_smartfox_tag(f, ew):
    roh = pd.read_csv(f, sep=";", dtype=str, encoding="latin-1", keep_default_na=False)
    roh.columns = [c.split("@")[0].strip() for c in roh.columns]
    roh = roh[roh["Time"] != "Time"]
    df = pd.DataFrame({"zeit": pd.to_datetime(roh["Time"], format="%Y-%m-%d %H:%M:%S", errors="coerce")})
    for quelle, ziel in SF_SPALTEN.items():
        df[ziel] = pd.to_numeric(roh[quelle], errors="coerce") if quelle in roh else np.nan
    df = df.dropna(subset=["zeit"]).drop_duplicates("zeit").sort_values("zeit")
    df.loc[(df["temp"] > 1500) | (df["temp"] < 0), "temp"] = np.nan
    df["temp"] = np.where(df["temp"] > 150, df["temp"] / 10, df["temp"])   # Zehntelgrad -> °C
    df["hp_w"] = df["hp_w"].clip(lower=0).fillna(0)

    # Allgemeinverbrauch (ohne Heizpatrone) je Messpunkt und Wärmepumpen-Erkennung
    last = df["pv_w"] + df["netz_w"] - df["hp_w"]
    ruhig = last[last < ew["grundlast_max_w"]]
    grundlast = ruhig.median() if len(ruhig) > 60 else 900.0
    df["wp_w"] = np.where(last - grundlast > ew["schwelle_ueber_grundlast_w"], last - grundlast, 0.0)
    df["netz_bezug_w"] = df["netz_w"].clip(lower=0)
    df["netz_einsp_w"] = (-df["netz_w"]).clip(lower=0)
    df["qh"] = df["zeit"].dt.floor("15min")
    g = df.groupby("qh")
    agg = pd.DataFrame({
        "sf_n": g.size(),
        "sf_pv": g["pv_w"].mean() * 0.25 / 1000,
        "sf_hp": g["hp_w"].mean() * 0.25 / 1000,
        "sf_wp": g["wp_w"].mean() * 0.25 / 1000,
        "sf_netz_bezug": g["netz_bezug_w"].mean() * 0.25 / 1000,
        "sf_netz_einsp": g["netz_einsp_w"].mean() * 0.25 / 1000,
        "temp_mittel": g["temp"].mean(),
        "temp_max": g["temp"].max(),
        "relais_wp": g["relais_wp"].mean(),
    })
    return agg


def lade_smartfox():
    ew = CFG["erkennung_waermepumpe"]
    dateien = sorted((ROOT / CFG["daten"]["smartfox_tage"]).glob("Smartfox_*.csv"))
    teile = []
    for i, f in enumerate(dateien):
        teile.append(lade_smartfox_tag(f, ew))
        if i % 100 == 0:
            print(f"  Smartfox {i}/{len(dateien)} …", file=sys.stderr)
    sf = pd.concat(teile)
    return sf[~sf.index.duplicated()].sort_index()


# --------------------------------------------------------------------------- Zusammenführen
def soll_index(start, ende):
    idx = pd.date_range(start, ende, freq="15min")
    # Sommerzeit-Umstellung: 02:00–02:45 am letzten Sonntag im März gibt es nicht
    luecke = np.zeros(len(idx), dtype=bool)
    for j in range(start.year, ende.year + 1):
        d = letzter_sonntag(j, 3)
        luecke |= (idx.normalize() == d) & (idx.hour == 2)
    return idx[~luecke]


def zusammenfuehren(allg, eda, sf):
    idx = soll_index(allg.index.min(), allg.index.max().normalize() + pd.Timedelta(hours=23, minutes=45))
    df = pd.DataFrame(index=idx)
    df.index.name = "zeit"
    df = df.join(allg).join(eda).join(sf)

    # --- fehlende Viertelstunden im Zähler-Export (jeweils letzte des Monats)
    df["allg_status"] = np.where(df["bezug_allg"].isna(), "ergaenzt", "gemessen")
    fehlt = df["einspeisung"].isna()
    df.loc[fehlt, "einspeisung"] = df.loc[fehlt, "eda_G"]
    df.loc[df["rest"].isna(), "rest"] = df.loc[df["rest"].isna(), "eda_R"]
    df["bezug_allg"] = df["bezug_allg"].interpolate(limit=2)
    df[["einspeisung", "rest"]] = df[["einspeisung", "rest"]].fillna(0)

    # --- Smartfox: nur Viertelstunden mit genügend Messpunkten gelten als gemessen
    ok = df["sf_n"].fillna(0) >= 10
    df["sf_status"] = np.where(ok, "gemessen", "geschaetzt")
    df["pv"] = np.where(ok, df["sf_pv"].clip(lower=0), np.nan)
    df["heizpatrone"] = np.where(ok, df["sf_hp"], 0.0)
    df["verbrauch_allg"] = df["pv"] - df["einspeisung"] + df["bezug_allg"] - df["heizpatrone"]

    # Messabweichung Smartfox/Zähler: Allgemeinverbrauch darf nicht negativ sein -> PV minimal anheben
    neg = ok & (df["verbrauch_allg"] < 0)
    df["pv_korrektur"] = 0.0
    df.loc[neg, "pv_korrektur"] = -df.loc[neg, "verbrauch_allg"]
    df.loc[neg, "pv"] += df.loc[neg, "pv_korrektur"]
    df.loc[neg, "verbrauch_allg"] = 0.0

    # Wärmepumpe / Grundlast (gemessene Viertelstunden)
    df["wp"] = np.where(ok, np.minimum(df["sf_wp"].fillna(0), df["verbrauch_allg"]), np.nan)
    df["grundlast_allg"] = df["verbrauch_allg"] - df["wp"]

    # --- Lücken im Smartfox: typischen Allgemeinverbrauch (Monat × Uhrzeit) einsetzen
    schluessel = [df.index.year, df.index.month, df.index.hour * 4 + df.index.minute // 15]
    typ_grund = df["grundlast_allg"].groupby(schluessel).transform("median")
    typ_wp = df["wp"].groupby(schluessel).transform("median")
    luecke = ~ok
    v_typ = (typ_grund + typ_wp)[luecke]
    pv_s = (df.loc[luecke, "einspeisung"] - df.loc[luecke, "bezug_allg"] + v_typ).clip(lower=0)
    df.loc[luecke, "pv"] = pv_s
    df.loc[luecke, "verbrauch_allg"] = pv_s - df.loc[luecke, "einspeisung"] + df.loc[luecke, "bezug_allg"]
    df.loc[luecke, "grundlast_allg"] = np.minimum(typ_grund[luecke], df.loc[luecke, "verbrauch_allg"])
    df.loc[luecke, "wp"] = df.loc[luecke, "verbrauch_allg"] - df.loc[luecke, "grundlast_allg"]
    return df


SPALTEN = (["bezug_allg", "einspeisung", "rest", "pv", "heizpatrone", "verbrauch_allg", "wp", "grundlast_allg",
            "temp_mittel", "temp_max", "relais_wp", "sf_netz_bezug", "sf_netz_einsp", "pv_korrektur",
            "eda_G", "eda_R"]
           + [f"{k}_{t}" for t in TOPS for k in ("v", "vt", "a", "e")]
           + ["allg_status", "sf_status"])


def main():
    AUSGABE.mkdir(parents=True, exist_ok=True)
    print("Lese Allgemeinzähler …", file=sys.stderr)
    allg, zs = lade_allgemein()
    print("Lese EDA …", file=sys.stderr)
    eda = lade_eda()
    print("Lese Smartfox …", file=sys.stderr)
    sf = lade_smartfox()
    df = zusammenfuehren(allg, eda, sf)
    for c in SPALTEN:
        if c not in df:
            df[c] = np.nan
    df = df[SPALTEN]
    for jahr, teil in df.groupby(df.index.year):
        pfad = AUSGABE / f"viertelstunden_{jahr}.csv"
        teil.to_csv(pfad, sep=";", decimal=",", float_format="%.4f", encoding="utf-8")
        print(f"  {pfad.relative_to(ROOT)}: {len(teil)} Viertelstunden", file=sys.stderr)
    zs.to_csv(AUSGABE / "zaehlerstaende.csv", sep=";", decimal=",", index=False, encoding="utf-8")
    print("Fertig.", file=sys.stderr)


if __name__ == "__main__":
    main()
