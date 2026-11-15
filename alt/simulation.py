import sys
import traceback
import os

def hauptprogramm():
    skript_ordner = os.path.dirname(os.path.abspath(__file__))
    os.chdir(skript_ordner)

    import pandas as pd
    import numpy as np
    import glob
    import warnings
    import matplotlib.pyplot as plt
    import configparser
    
    try:
        import plotly.graph_objects as go
        from plotly.subplots import make_subplots
        plotly_verfuegbar = True
    except ImportError:
        plotly_verfuegbar = False

    warnings.simplefilter(action='ignore', category=FutureWarning)

    print("🚀 STARTE LOKALE HAUS-SIMULATION (PV- & Temperatur-Fix)...\n")

    # ==========================================
    # ⚙️ EINSTELLUNGEN AUS DATEI LADEN
    # ==========================================
    config_datei = 'einstell.ini'

    if not os.path.exists(config_datei):
        print(f"❌ FEHLER: Die Datei '{config_datei}' wurde nicht gefunden!")
        return

    config = configparser.ConfigParser()
    config.read(config_datei, encoding='utf-8')

    try:
        speicher_kapazitaet_kwh = config.getfloat('Batterie', 'speicher_kapazitaet_kwh')
        max_ladeleistung_kw = config.getfloat('Batterie', 'max_ladeleistung_kw')
        max_entladeleistung_kw = config.getfloat('Batterie', 'max_entladeleistung_kw')
        speicher_verlust_faktor = config.getfloat('Batterie', 'speicher_verlust_faktor')
        notstrom_reserve = config.getfloat('Batterie', 'notstrom_reserve')
        
        wp_cop = config.getfloat('Thermodynamik', 'wp_cop')
        boiler_volumen_liter = config.getfloat('Thermodynamik', 'boiler_volumen_liter')
        wp_not_temp = config.getfloat('Thermodynamik', 'wp_not_temp')
        wp_ziel_temp = config.getfloat('Thermodynamik', 'wp_ziel_temp')
        
        gesamt_anteile = config.getfloat('Finanzen', 'gesamt_anteile')
        anteile_text = config.get('Finanzen', 'anteile_text')
        preis_pro_kwh_netz = config.getfloat('Finanzen', 'preis_pro_kwh_netz')
        preis_pro_kwh_eeg = config.getfloat('Finanzen', 'preis_pro_kwh_eeg')
        
        anteile_roh = [float(x.strip()) for x in anteile_text.split(',')]
        wohnungs_anteile = [x / gesamt_anteile for x in anteile_roh]
    except Exception as e:
        print(f"❌ FEHLER in der 'einstell.ini': {e}")
        return

    print(f"✅ Einstellungen geladen! (Batterie: {speicher_kapazitaet_kwh} kWh)")

    # ==========================================
    # 1. DATEN EINLESEN
    # ==========================================
    print("Lese Smartfox (Sichere Suche für PV, Boiler & Temp)...")
    sf_files = glob.glob("Smartfox/*.csv")
    df_sf_list = []
    
    for f in sf_files:
        temp = pd.read_csv(f, sep=';', on_bad_lines='skip', low_memory=False)
        try:
            col_time = [c for c in temp.columns if 'Time' in c][0]
            cols_pv = [c for c in temp.columns if 'PvPower@' in c]
            cols_boiler = [c for c in temp.columns if 'UsedPower@' in c and ('Boiler' in c or 'Heizpatrone' in c)]
            col_temp = [c for c in temp.columns if 'TemperaturePT1000@' in c]
            col_temp = col_temp[0] if len(col_temp) > 0 else None
            
            cols_to_keep = [col_time] + cols_pv + cols_boiler
            if col_temp: cols_to_keep.append(col_temp)
            
            temp = temp[cols_to_keep].dropna(subset=[col_time])
            temp = temp[temp[col_time] != 'Time']
            
            saubere_zeit = temp[col_time].astype(str).str.replace(r'^[a-zA-ZäöüÄÖÜß]{2}\.,?\s*', '', regex=True)
            saubere_zeit = saubere_zeit.str.replace(r'^[a-zA-Z]{3},\s*', '', regex=True)
            temp['Zeit'] = pd.to_datetime(saubere_zeit, dayfirst=True, errors='coerce')
            
            for col in cols_pv: temp[col] = pd.to_numeric(temp[col], errors='coerce').fillna(0)
            temp['PV_W_Gesamt'] = temp[cols_pv].sum(axis=1)
            
            if len(cols_boiler) > 0:
                for col in cols_boiler: temp[col] = pd.to_numeric(temp[col], errors='coerce').fillna(0)
                temp['Boiler_W_Gesamt'] = temp[cols_boiler].sum(axis=1)
            else:
                temp['Boiler_W_Gesamt'] = 0.0

            if col_temp:
                temp['Temp_Real'] = pd.to_numeric(temp[col_temp], errors='coerce').fillna(50.0)
            else:
                temp['Temp_Real'] = 50.0 
                
            df_sf_list.append(temp[['Zeit', 'PV_W_Gesamt', 'Boiler_W_Gesamt', 'Temp_Real']].dropna())
        except:
            pass

    df_sf_raw = pd.concat(df_sf_list).set_index('Zeit')
    df_sf_power = df_sf_raw[['PV_W_Gesamt', 'Boiler_W_Gesamt']].resample('15min').sum().fillna(0)
    df_sf_power['PV_kWh'] = (df_sf_power['PV_W_Gesamt'] / 30) / 1000 / 4
    df_sf_power['Boiler_kWh'] = (df_sf_power['Boiler_W_Gesamt'] / 30) / 1000 / 4
    df_sf_temp = df_sf_raw[['Temp_Real']].resample('15min').mean().fillna(50.0)
    df_sf = df_sf_power.join(df_sf_temp)

    print("Lese Allgemeinzähler...")
    allg_files = glob.glob("Allgemein/*.csv")
    df_allg_list = []
    for f in allg_files:
        temp = pd.read_csv(f, sep=';', header=None, on_bad_lines='skip', low_memory=False)
        data_rows = temp[temp[0].str.contains(r'\d{2}\.\d{2}\.\d{4}', na=False)].copy()
        data_rows['Zeit'] = data_rows[0].astype(str).str.split(' - ').str[0]
        data_rows['Zeit'] = pd.to_datetime(data_rows['Zeit'], format='%d.%m.%Y %H:%M', errors='coerce')
        data_rows['Allgemein_kWh'] = data_rows[1].astype(str).str.replace(',', '.').astype(float)
        df_allg_list.append(data_rows[['Zeit', 'Allgemein_kWh']].dropna())
    df_allg_15m = pd.concat(df_allg_list).set_index('Zeit').sort_index()
    df_allg_15m = df_allg_15m[~df_allg_15m.index.duplicated(keep='first')]

    print("Lese Wohnungsverbrauch (EDA)...")
    eda_files = glob.glob("EDA/*.csv")
    df_eda_list = []
    for f in eda_files:
        df_raw = pd.read_csv(f, sep=';', header=None, dtype=str, on_bad_lines='skip', low_memory=False)
        try:
            id_row = df_raw[df_raw[0] == 'MeteringPointId'].values[0]
            code_row = df_raw[df_raw[0] == 'MeterCode'].values[0]
            
            wohnung_cols = []
            wohnung_namen = []
            for i in range(1, len(id_row)):
                val_id = str(id_row[i]).strip()
                val_code = str(code_row[i]).strip()
                if val_id.endswith('A') and 'Gesamtverbrauch' in val_code:
                    wohnung_cols.append(i)
                    wohnung_namen.append(f"Zähler {val_id[-4:]}")
                    
            data_rows = df_raw[df_raw[0].str.contains(r'\d{2}\.\d{2}\.\d{4}', na=False)].copy()
            df_clean = data_rows[[0] + wohnung_cols].copy()
            df_clean.columns = ['Zeit'] + wohnung_namen
            df_clean['Zeit'] = pd.to_datetime(df_clean['Zeit'], format='%d.%m.%Y %H:%M', errors='coerce')
            df_clean = df_clean.dropna(subset=['Zeit'])
            for col in df_clean.columns[1:]:
                df_clean[col] = df_clean[col].str.replace(',', '.').astype(float)
            df_eda_list.append(df_clean)
        except:
            pass

    df_eda = pd.concat(df_eda_list).set_index('Zeit').resample('15min').mean().fillna(0)
    df_eda = df_eda[~df_eda.index.duplicated(keep='first')]
    df_eda = df_eda.reindex(sorted(df_eda.columns), axis=1)
    wohnung_spalten = df_eda.columns.tolist()

    anteile_dict = {}
    for i, col in enumerate(wohnung_spalten):
        anteile_dict[col] = wohnungs_anteile[i] if i < len(wohnungs_anteile) else 0.0

    # ==========================================
    # 2. DATEN SYNCHRONISIEREN 
    # ==========================================
    df = df_sf[['PV_kWh', 'Boiler_kWh', 'Temp_Real']].join(df_allg_15m[['Allgemein_kWh']], how='outer')
    df = df.join(df_eda, how='outer').fillna(0)
    df = df[df.index <= '2026-12-31 23:59:59']

    df['Echte_Grundlast_kWh'] = np.maximum(0, df['Allgemein_kWh'] - df['Boiler_kWh'])
    df['Wohnungen_Summe_kWh'] = df[wohnung_spalten].sum(axis=1)
    df['Bedarf_Haus_Ohne_Boiler'] = df['Wohnungen_Summe_kWh'] + df['Echte_Grundlast_kWh']
    df['Bedarf_Haus_Gesamt'] = df['Bedarf_Haus_Ohne_Boiler'] + df['Boiler_kWh']
    df['Fehlmenge_U2'] = np.maximum(0, df['Bedarf_Haus_Ohne_Boiler'] - df['PV_kWh'])

    print(f"✅ Check: Gesamt-PV geladen: {df['PV_kWh'].sum():,.0f} kWh".replace(',', '.'))

    # ==========================================
    # 3. DIE BATTERIE-SIMULATION
    # ==========================================
    akku_stand_kwh = speicher_kapazitaet_kwh * notstrom_reserve
    min_akku_kwh = speicher_kapazitaet_kwh * notstrom_reserve
    max_lade_15m = max_ladeleistung_kw / 4
    max_entlade_15m = max_entladeleistung_kw / 4

    kwh_pro_grad_celsius = boiler_volumen_liter * 0.00116
    waerme_defizit_kwh = 0.0 

    u3_netz_allg_list = []
    u3_netz_w_dict = {col: [] for col in wohnung_spalten}
    u3_eeg_allg_list = []
    u3_eeg_w_dict = {col: [] for col in wohnung_spalten}
    wp_extra_strom_list = []
    akku_verlauf = []
    temp_sim_verlauf = []

    print("Simuliere Batterie und Thermodynamik...")

    for index, row in df.iterrows():
        pv = row['PV_kWh']
        bedarf_haus = row['Bedarf_Haus_Ohne_Boiler'] 
        boiler_ist = row['Boiler_kWh']
        echte_grundlast = row['Echte_Grundlast_kWh']
        temp_real = row['Temp_Real']
        
        wp_extra_strom_kwh = 0
        temp_sim = temp_real - (waerme_defizit_kwh / kwh_pro_grad_celsius)
        
        if temp_sim <= wp_not_temp:
            wp_extra_strom_kwh = waerme_defizit_kwh / wp_cop
            bedarf_haus += wp_extra_strom_kwh
            echte_grundlast += wp_extra_strom_kwh
            waerme_defizit_kwh = 0
            temp_sim = temp_real 
            
        temp_sim_verlauf.append(temp_sim)
        wp_extra_strom_list.append(wp_extra_strom_kwh)
        
        bilanz = pv - bedarf_haus
        sim_boiler_bekommt = 0
        eeg_strom_genutzt = 0
        
        if bilanz > 0:
            eeg_strom_genutzt = bedarf_haus
            lade_potential = bilanz * (1 - speicher_verlust_faktor)
            lade_menge = min(lade_potential, max_lade_15m, speicher_kapazitaet_kwh - akku_stand_kwh)
            akku_stand_kwh += lade_menge
            
            rest_pv = bilanz - (lade_menge / (1 - speicher_verlust_faktor))
            sim_boiler_bekommt = min(rest_pv, boiler_ist)
            
            u3_netz_allg_list.append(0) 
            for col in wohnung_spalten: u3_netz_w_dict[col].append(0)
        else:
            fehlmenge = abs(bilanz)
            entlade_potential = fehlmenge / (1 - speicher_verlust_faktor)
            entlade_menge = min(entlade_potential, max_entlade_15m, akku_stand_kwh - min_akku_kwh)
            akku_stand_kwh -= entlade_menge
            genutzt_im_haus = entlade_menge * (1 - speicher_verlust_faktor)
            
            rest_bezug_netz = fehlmenge - genutzt_im_haus
            eeg_strom_genutzt = pv + genutzt_im_haus
            sim_boiler_bekommt = 0
            
            if bedarf_haus > 0:
                u3_netz_allg_list.append((rest_bezug_netz * (echte_grundlast / bedarf_haus)))
                for col in wohnung_spalten: u3_netz_w_dict[col].append(rest_bezug_netz * (row[col] / bedarf_haus))
            else:
                u3_netz_allg_list.append(0)
                for col in wohnung_spalten: u3_netz_w_dict[col].append(0)
                
        waerme_defizit_kwh += max(0, boiler_ist - sim_boiler_bekommt)

        if bedarf_haus > 0:
            u3_eeg_allg_list.append(eeg_strom_genutzt * (echte_grundlast / bedarf_haus) + sim_boiler_bekommt)
            for col in wohnung_spalten: u3_eeg_w_dict[col].append(eeg_strom_genutzt * (row[col] / bedarf_haus))
        else:
            u3_eeg_allg_list.append(sim_boiler_bekommt)
            for col in wohnung_spalten: u3_eeg_w_dict[col].append(0)

        akku_verlauf.append(akku_stand_kwh)

    df['U3_Netz_Allg'] = u3_netz_allg_list
    df['U3_EEG_Allg'] = u3_eeg_allg_list
    df['WP_Extra_Strom'] = wp_extra_strom_list
    df['Akku_SoC'] = akku_verlauf
    df['Temp_Simuliert'] = temp_sim_verlauf

    # DIE FEHLENDEN 4 ZEILEN (Die Spalten ins DataFrame schreiben!)
    for col in wohnung_spalten:
        df[f'U3_Netz_{col}'] = u3_netz_w_dict[col]
        df[f'U3_EEG_{col}'] = u3_eeg_w_dict[col]

    # ==========================================
    # 4. INTERAKTIVER KALENDER (PLOTLY HTML)
    # ==========================================
    if plotly_verfuegbar:
        print("Erstelle interaktiven Kalender (HTML)...")
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        fig.add_trace(go.Scatter(x=df.index, y=df['PV_kWh']*4, name="PV Leistung (kW)", fill='tozeroy', line=dict(color='gold')), secondary_y=False)
        fig.add_trace(go.Scatter(x=df.index, y=df['Akku_SoC'], name="Batterie Ladestand (kWh)", line=dict(color='green', width=2)), secondary_y=False)
        fig.add_trace(go.Scatter(x=df.index, y=df['Temp_Simuliert'], name="Boiler Temp. simuliert (°C)", line=dict(color='red', width=1.5)), secondary_y=True)

        fig.update_layout(
            title_text=f"Haus-Simulator: Batterie, PV & Heizung ({speicher_kapazitaet_kwh} kWh)",
            xaxis=dict(
                rangeselector=dict(
                    buttons=list([
                        dict(count=1, label="1 Tag", step="day", stepmode="backward"),
                        dict(count=3, label="3 Tage", step="day", stepmode="backward"),
                        dict(count=7, label="1 Woche", step="day", stepmode="backward"),
                        dict(step="all", label="Alles")
                    ])
                ),
                rangeslider=dict(visible=True),
                type="date"
            )
        )
        fig.update_yaxes(title_text="Leistung (kW) / Ladestand (kWh)", secondary_y=False)
        fig.update_yaxes(title_text="Temperatur (°C)", secondary_y=True)
        
        html_datei = "Interaktiver_Kalender.html"
        fig.write_html(html_datei)
        print(f"✅ Interaktiver Kalender gespeichert als: {html_datei}")

    # ==========================================
    # 5. JAHRES-AUSWERTUNGEN
    # ==========================================
    jahre = sorted(df.index.year.unique())

    for jahr in jahre:
        df_jahr = df[df.index.year == jahr].copy()
        if df_jahr['Bedarf_Haus_Ohne_Boiler'].sum() == 0 and df_jahr['PV_kWh'].sum() == 0:
            continue
            
        print("\n" + "🔥"*30)
        print(f"      AUSWERTUNG FÜR DAS JAHR {jahr}")
        print("🔥"*30)
        
        df_jahr['Hausleistung_kW'] = df_jahr['Bedarf_Haus_Ohne_Boiler'] * 4
        max_peak_kw = df_jahr['Hausleistung_kW'].max()
        max_peak_zeit = df_jahr['Hausleistung_kW'].idxmax()
        
        print(f"\n⚡ LASTSPITZE IM JAHR {jahr}: {max_peak_kw:,.1f} kW (Am {max_peak_zeit.strftime('%d.%m. um %H:%M')} Uhr)".replace(',', '.'))
        if max_peak_kw > max_entladeleistung_kw:
            print(f"⚠️ Eure eingestellten {max_entladeleistung_kw} kW Entladeleistung waren hier zu schwach!")
        else:
            print(f"✅ Die {max_entladeleistung_kw} kW reichten aus, um Lastspitzen abzudecken.")
            
        wp_extra_summe = df_jahr['WP_Extra_Strom'].sum()
        if wp_extra_summe > 0:
            print(f"\n🌡️ KANNIBALISMUS-EFFEKT {jahr}:")
            print(f"   Erdwärmepumpe musste {round(wp_extra_summe, 0):.0f} kWh Netzstrom ziehen (Batterie hat dem Boiler den Strom geklaut).")

        nutzbare_kapazitaet = speicher_kapazitaet_kwh * (1 - notstrom_reserve)
        echte_entladung_summe = np.maximum(0, df_jahr['Akku_SoC'].shift(1) - df_jahr['Akku_SoC']).sum()
        vollzyklen = echte_entladung_summe / nutzbare_kapazitaet if nutzbare_kapazitaet > 0 else 0
        
        anzahl_viertelstunden = len(df_jahr)
        limit_leer = min_akku_kwh + (speicher_kapazitaet_kwh * 0.01)
        limit_voll = speicher_kapazitaet_kwh - (speicher_kapazitaet_kwh * 0.01)
        
        stunden_leer = len(df_jahr[df_jahr['Akku_SoC'] <= limit_leer]) / 4
        stunden_voll = len(df_jahr[df_jahr['Akku_SoC'] >= limit_voll]) / 4
        stunden_gesamt = anzahl_viertelstunden / 4
        
        prozent_leer = (stunden_leer / stunden_gesamt) * 100
        prozent_voll = (stunden_voll / stunden_gesamt) * 100
        
        print("\n🔋 BATTERIE-AUSLASTUNG:")
        print(f"   Vollzyklen (Jahresziel: ca. 200-250) : {vollzyklen:,.0f} Zyklen".replace(',', '.'))
        print(f"   Zeitraum komplett leer (am Limit)    : {stunden_leer:,.0f} Stunden ({prozent_leer:.1f} % des Jahres)".replace(',', '.'))
        print(f"   Zeitraum randvoll (100%)             : {stunden_voll:,.0f} Stunden ({prozent_voll:.1f} % des Jahres)".replace(',', '.'))

        u1_allg = df_jahr['Allgemein_kWh'].sum()
        u1_w_dict = {col: np.maximum(0, df_jahr[col] - df_jahr['PV_kWh'] * anteile_dict[col]).sum() for col in wohnung_spalten}
        u1_data = [u1_allg] + list(u1_w_dict.values())
        
        ratio_allg_u2 = np.where(df_jahr['Bedarf_Haus_Ohne_Boiler'] > 0, df_jahr['Echte_Grundlast_kWh'] / df_jahr['Bedarf_Haus_Ohne_Boiler'], 0)
        u2_allg = (df_jahr['Fehlmenge_U2'] * ratio_allg_u2).sum()
        u2_w_dict = {}
        for col in wohnung_spalten:
            ratio_w = np.where(df_jahr['Bedarf_Haus_Ohne_Boiler'] > 0, df_jahr[col] / df_jahr['Bedarf_Haus_Ohne_Boiler'], 0)
            u2_w_dict[col] = (df_jahr['Fehlmenge_U2'] * ratio_w).sum()
        u2_data = [u2_allg] + list(u2_w_dict.values())
        
        u3_data = [df_jahr['U3_Netz_Allg'].sum()] + [df_jahr[f'U3_Netz_{col}'].sum() for col in wohnung_spalten]
        eeg_data = [df_jahr['U3_EEG_Allg'].sum()] + [df_jahr[f'U3_EEG_{col}'].sum() for col in wohnung_spalten]
        
        print("\n💰 KASSENSTURZ:")
        print(f"Aktueller Vertrag (Starr)    : {sum(u1_data):,.0f} kWh Netzbezug".replace(',', '.'))
        print(f"Dynamisch (+ {speicher_kapazitaet_kwh} kWh Akku) : {sum(u3_data):,.0f} kWh Netzbezug".replace(',', '.'))
        print(f"ERSPARNIS TOTAL IN {jahr}     : {sum(u1_data) - sum(u3_data):,.0f} kWh".replace(',', '.'))
        
        print(f"\n🤝 INTERNE EEG-ABRECHNUNG {jahr} (Geld für die Hauskasse)")
        print("-" * 55)
        print(f"{'Zähler':<12} | {'EEG-Strom genutzt':>18} | {'Einnahmen Kasse':>15}")
        print("-" * 55)
        einnahmen_kasse = eeg_data[0] * preis_pro_kwh_eeg
        print(f"{'Allgemein':<12} | {eeg_data[0]:13,.0f} kWh | {einnahmen_kasse:12,.2f} €".replace(',', '.'))
        for i, col in enumerate(wohnung_spalten):
            euro_w = eeg_data[i+1] * preis_pro_kwh_eeg
            einnahmen_kasse += euro_w
            print(f"{col[:10]:<12} | {eeg_data[i+1]:13,.0f} kWh | {euro_w:12,.2f} €".replace(',', '.'))
        print("-" * 55)
        print(f"💸 TOTAL IN DIE KASSE {jahr}: {einnahmen_kasse:22,.2f} €".replace(',', '.'))
        
        labels = ['Allg.'] + [f'{c[-4:]}' for c in wohnung_spalten]
        x = np.arange(len(labels))
        width = 0.25

        fig, ax = plt.subplots(figsize=(14, 6))
        bar1 = ax.bar(x - width, u1_data, width, label='U1: Aktuell (Starr)', color='crimson', edgecolor='black')
        bar2 = ax.bar(x, u2_data, width, label='U2: Dynamisch (ohne Akku)', color='orange', edgecolor='black')
        bar3 = ax.bar(x + width, u3_data, width, label=f'U3: Dynamisch (+ {speicher_kapazitaet_kwh} kWh)', color='forestgreen', edgecolor='black')

        ax.set_ylabel('Netzbezug in kWh', fontsize=12, fontweight='bold')
        ax.set_title(f'Wer spart wie viel im Jahr {jahr}?', fontsize=15, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(labels, fontsize=11, fontweight='bold', rotation=45, ha='right')
        ax.legend(fontsize=11)
        ax.grid(axis='y', linestyle='--', alpha=0.7)

        def add_labels(bars):
            for bar in bars:
                height = bar.get_height()
                if height > 1:
                    ax.annotate(f'{int(height)}', xy=(bar.get_x() + bar.get_width()/2, height), xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', fontsize=8, rotation=90)

        add_labels(bar1)
        add_labels(bar2)
        add_labels(bar3)
        plt.tight_layout()
        plt.show(block=True)
        print("\n")

if __name__ == '__main__':
    try:
        hauptprogramm()
    except Exception as e:
        print("\n" + "❌"*20)
        print("KRITISCHER FEHLER AUFGETRETEN:")
        print(traceback.format_exc())
        print("❌"*20)
    finally:
        input("\nDrücke ENTER, um das Fenster zu schließen...")