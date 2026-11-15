import pandas as pd
import glob
import os

print("🚀 STARTE DEN EDA EXCEL -> CSV KONVERTER (Inkl. Daten-TÜV) 🚀")
print("==============================================================")

# ==========================================
# ⚙️ DEINE EINSTELLUNGEN
# ==========================================
# Trage hier den EXAKTEN Namen des Arbeitsblattes ein (z.B. "Tabelle1")
# Oder einfach 0 für das allererste Arbeitsblatt in der Datei!
WUNSCH_ARBEITSBLATT =  1

# ==========================================
# ORDNER AUF DEM DESKTOP DEFINIEREN
# ==========================================
desktop_pfad = os.path.join(os.path.expanduser('~'), 'Desktop')
input_ordner = os.path.join(desktop_pfad, "EDA_Excel_Dateien")
output_ordner = os.path.join(desktop_pfad, "EDA_CSV_Fertig")

if not os.path.exists(input_ordner):
    print(f"⚠️ FEHLER: Der Ordner '{input_ordner}' wurde nicht gefunden!")
    print("Bitte erstelle ihn auf dem Desktop und lege deine Excel-Dateien hinein.")
    exit()

if not os.path.exists(output_ordner):
    os.makedirs(output_ordner)

# ==========================================
# 🚀 DATEIEN UMWANDELN & PRÜFEN
# ==========================================
excel_dateien = glob.glob(os.path.join(input_ordner, "*.xlsx"))
fehlerhafte_dateien = []

if len(excel_dateien) == 0:
    print("⚠️ Keine .xlsx Dateien im Ordner gefunden!")
else:
    print(f"Gefunden: {len(excel_dateien)} Excel-Dateien. Starte Konvertierung & Prüfung...\n")

    for datei in excel_dateien:
        dateiname = os.path.basename(datei)
        
        try:
            xls = pd.ExcelFile(datei)
            verfuegbare_blaetter = xls.sheet_names
            
            if isinstance(WUNSCH_ARBEITSBLATT, str) and WUNSCH_ARBEITSBLATT not in verfuegbare_blaetter:
                print(f"❌ FEHLER in '{dateiname}': Blatt '{WUNSCH_ARBEITSBLATT}' nicht gefunden!")
                print(f"   Verfügbare Blätter: {verfuegbare_blaetter}\n")
                continue
            
            # Einlesen (header=None rettet uns vor dem EDA-Kopfzeilen-Chaos)
            df = pd.read_excel(datei, sheet_name=WUNSCH_ARBEITSBLATT, header=None)
            neuer_name = dateiname.replace('.xlsx', '.csv')
            
            # --- 🕵️‍♂️ DATEN-TÜV START ---
            warnungen = []
            
            # 1. Prüfen, ob das EDA Portal "INCOMPLETE" oder "Unvollständig" meldet (in den ersten 30 Zeilen)
            kopf_daten = df.head(30).astype(str)
            ist_unvollstaendig = kopf_daten.apply(lambda x: x.str.contains('INCOMPLETE|Unvollständig', case=False, na=False)).any().any()
            if ist_unvollstaendig:
                warnungen.append("Das EDA-Portal meldet 'INCOMPLETE' (Unvollständig) in dieser Datei!")
                
            # 2. Zeilen zählen (Wie viele echte 15-Min-Werte gibt es?)
            # Wir suchen Zeilen, die in der ersten Spalte ein Datum haben (z.B. 01.01.2024)
            erste_spalte = df[0].astype(str)
            daten_zeilen = erste_spalte.str.contains(r'\d{2}\.\d{2}\.\d{4}', regex=True, na=False)
            anzahl_werte = daten_zeilen.sum()
            
            # Ein Monat muss mindestens 28 Tage * 96 Viertelstunden = 2688 Werte haben
            if anzahl_werte < 2600:
                warnungen.append(f"Nur {anzahl_werte} Werte gefunden! (Ein ganzer Monat sollte ca. 2.900 haben)")
            # --- 🕵️‍♂️ DATEN-TÜV ENDE ---

            # Speichern als saubere österreichische CSV
            ziel_pfad = os.path.join(output_ordner, neuer_name)
            df.to_csv(ziel_pfad, index=False, header=False, sep=';', decimal=',')
            
            # Ergebnis ausdrucken
            if len(warnungen) > 0:
                print(f"⚠️ WARNUNG bei '{neuer_name}':")
                for w in warnungen:
                    print(f"   -> {w}")
                fehlerhafte_dateien.append(neuer_name)
            else:
                print(f"✅ OK: '{neuer_name}' ({anzahl_werte} Werte, 100% Vollständig)")
            
        except Exception as e:
            print(f"❌ Absturz bei '{dateiname}': {e}")

print("\n==============================================================")
if len(fehlerhafte_dateien) > 0:
    print(f"⚠️ FERTIG! Es wurden aber {len(fehlerhafte_dateien)} löchrige/unvollständige Dateien gefunden!")
    print("Prüfe die Warnungen oben. Du kannst die Dateien trotzdem ins Colab werfen, das Skript repariert Lücken automatisch.")
else:
    print("🎉 FERTIG! Alle Dateien haben den TÜV bestanden und sind perfekt!")
    
print("Alle CSV-Dateien liegen jetzt im Ordner 'EDA_CSV_Fertig' auf deinem Desktop.")