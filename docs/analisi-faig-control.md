# FAIG CONTROL — anàlisi de l'app AppSheet original

Font: *Application Documentation* d'AppSheet (v1.000239, generada el 16/11/2026).
19 taules (13 de dades reals), 244 columnes, 5 slices, 58 vistes, 71 accions (9 de pròpies), 5 regles de format, 2 bots.

Aquest document és la referència funcional per replicar i generalitzar l'app.

---

## 1. Mòduls funcionals

| Mòdul | Taules | Què fa |
|---|---|---|
| **Espais i sessions** | `ESPAIS`, `SESSIONS` | Calendari de sessions a l'aula (data, hores, grup, projecte, espai, estat) |
| **Projectes** | `PROJECTES` | Projectes per curs/grup amb responsable; agrupa sessions, usos de màquines i consum |
| **Màquines** | `MÀQUINES`, `USOS_MÀQUINES` | Inventari de màquines i registre d'ús (iniciar / finalitzar ús) |
| **Manteniment** | `MANTENIMENT` | Tasques de manteniment per màquina, periodicitat, propera revisió |
| **Incidències** | `INCIDENCIES` | Avaries i problemes amb prioritat i estat |
| **Préstec de material** | `MATERIALS`, `MOVIMENTS` | Material inventariable (robòtica, eines…) que es presta i es retorna |
| **Consumibles i estoc** | `CATÀLEG_MATERIALS`, `CONSUMIBLES`, `MOVIMENTS_CONSUMIBLES` | Catàleg → variants amb estoc; entrades, sortides, pèrdues i ajustos; avís d'estoc mínim |
| **Usuaris i rols** | `USUARIS` | Correu + rol; controla permisos per taula |
| *(navegació)* | `ACESSOS_RÀPIDS`, `_Per User Settings` | Truc per fer el menú de l'inici / plantilla per defecte d'AppSheet. **No cal replicar-ho** |

---

## 2. Model de dades

Notació: **PK** clau, → referència, *virtual* = calculat.

### ESPAIS
`Espai_ID`, **Nom_espai**, Descripció, Ubicació, Capacitat (núm.), Equipament, Normes_us, Actiu (sí/no)

### SESSIONS
`Sessió_ID`, Data, Hora_inici, Hora_fi, Mestra (correu, per defecte l'usuari), Grup (enum), → Projecte, Activitat, → Espai, Estat, Observacions
- Grup: `5è A`, `5è B`, `5è C`, `6è A`, `6è B`, `Sense grup`, `Altres`
- Estat: `Programada` (defecte), `Realitzada`, `Cancel·lada`

### PROJECTES
`Projecte_ID`, **Nom_projecte**, Estat, Curs, Grups (text), → Responsable (USUARIS), Data_inici, Data_final, Descripció, Producte_final
- Estat: `En preparació`, `Actiu`, `Finalitzat`, `Aturat`

### MÀQUINES
**Nom**, Marca_model, Categoria, Ubicació, Responsable (correu), Manual (URL), Instruccions (URL), Data_adquisició, Última_revisió, Estat, Fotografia
- Categoria: `Impressora 3D`, `Tall i gravat làser`, `Tall de vinil`, `Brodat`, `Escaneig 3D`, `Eina de fabricació digital`
- Estat: `Operativa`, `En ús`, `Avaria`, `En manteniment`, `Fora de servei`

### USOS_MÀQUINES
`Us_ID`, → Màquina, Usuari (correu actual), Data (avui), Hora_Inici (ara), Hora_prevista_fi, Hora_fi, → Projecte, → Material_utilitzat (MATERIALS), *Durada* = Hora_fi − Hora_Inici, Estat_final, Observacions
- Estat_final: `Correcte`, `Incidència`, `Necessita revisió`

### MANTENIMENT
→ Màquina, Tipus_manteniment, Tasca, Data_prevista, Data_realitzacio, Responsable (correu), Periodicitat, Estat, Descripcio_actuacio, Fotografia, Propera_revisio, Observacions
- Tipus: `Preventiu`, `Correctiu`, `Neteja`, `Calibratge`, `Revisió de seguretat`, `Actualització`
- Periodicitat: `Després de cada ús`, `Setmanal`, `Mensual`, `Trimestral`, `Semestral`, `Anual`, `Quan sigui necessari`
- Estat: `Pendent`, `Programat`, `En curs`, `Realitzat`, `Cancel·lat`

### INCIDENCIES
`Incidencia_ID`, Data (avui), Hora (ara), Usuari (correu actual), **Tipus_incidencia**, Element_afectat (text lliure), Descripció, Fotografia, Prioritat, Estat, Responsable (correu), Data_resolució, Resolució, Observacions
- Tipus: `Màquina`, `Eina`, `Material`, `Consumible`, `Instal·lació`, `Mobiliari`, `Seguretat`, `Altres`
- Prioritat: `Baixa`, `Mitjana`, `Alta`, `Urgent`
- Estat: `Pendent`, `En revisió`, `En reparació`, `Resolta`, `No procedeix`

### MATERIALS (préstec)
`Material_ID`, **Nom**, Categoria, Descripció, Quantitat_total, Ubicació, Estat, Fotografia, Observacions
- *Quantitat_prestada* = suma de MOVIMENTS d'aquest material sense Data_retorn
- *Quantitat_disponible* = total − prestada
- *Disponibilitat_estoc* = `Unitats disponibles` / `Sense unitats disponibles`
- Categoria: `Robòtica`, `Electrònica`, `Eines manuals`, `Construcció`, `Science`, `Material design thinking`, `Perifèrics robòtica`
- Estat: `Disponible`, `Deteriorat`, `En reparació`, `Fora de servei`

### MOVIMENTS (préstecs)
`Moviment_ID`, → Material, Usuari (text), **Data_sortida** (avui), Quantitat (defecte 1), Data_retorn_prevista, Data_retorn, Estat (defecte `Prestat`), Observacions
- Validació: 0 < Quantitat ≤ disponible (total − préstecs oberts, excloent la fila actual)
- Estat: `Prestat`, `Retornat`, `Perdut`, `Deteriorat`

### CATÀLEG_MATERIALS
`Catalog_ID`, Categoria, **Nom_material**, Descripció, Fotografia, Usos, Compatibilitat, Actiu
- Categoria: `Fusta i derivats`, `Plàstics`, `Impressió 3D`, `Vinils`, `Paper i cartró`, `Materials flexibles`, `Adhesius`, `Material tèxtil`, `Electrònica`, `Pintures i acabats`, `Altres`

### CONSUMIBLES (variants amb estoc)
`Consumible_ID`, → Catàleg, Nom_variant, Color, Acabat, Gruix_mm, Amplada_mm, Llargada_mm, Format, Unitat_estoc, Estoc_minim, Ubicació, Fotografia, Observacions, Actiu
- *Nom_complet* = `Nom_variant - Color`
- *Estoc_actual* = Entrades − Sortides − Pèrdues + Ajustos (des de MOVIMENTS_CONSUMIBLES)
- *Estat_estoc* = `Correcte` / `Cal reposar` / `Sense estoc` (amb colors)
- Format: `Planxa`, `Bobina`, `Rotlle`, `Full`, `Peça`, `Pot`, `Ampolla`, `Paquet`, `Caixa`, `Altres`
- Unitat_estoc: `Unitats`, `Grams`, `Quilograms`, `Metres`, `Litres`, `Mil·lilitres`, `Planxes`, `Bobines`, `Rotlles`, `Paquets`, `Pots`

### MOVIMENTS_CONSUMIBLES
→ Consumible, **Tipus_moviment**, Data (avui), Quantitat (defecte 1), Unitat (copiada del consumible), Usuari (correu actual), → Projecte, Proveidor, Preu_total, Document_compra (fitxer), Observacions
- Tipus: `Entrada`, `Sortida`, `Pèrdua o deteriorament`, `Ajust estoc`
- Validació: Entrada > 0; Sortida > 0 i ≤ estoc actual
- Proveïdor, preu i document només es mostren a les entrades

### USUARIS
`Usuari_ID`, Nom, Correu, Rol, Actiu
- Rol: `Mestra`, `Equip motor FAIG`, `Equip directiu`

---

## 3. Permisos per rol

| Taula | Mestra | Equip motor / Equip directiu |
|---|---|---|
| Espais, Màquines, Materials, Catàleg | només lectura | afegir i editar |
| Sessions, Projectes | afegir i editar | afegir i editar |
| Usos de màquines, Incidències, Manteniment, Consumibles, Moviments, Moviments de consumibles | només afegir | afegir i editar |
| Usuaris | només veu la seva fila | només veu la seva fila |

Ningú no pot esborrar res des de l'app. Si el correu no és a `USUARIS`, l'usuari només té lectura.

---

## 4. Lògica, vistes i automatitzacions

**Accions pròpies**
- `INICIAR ÚS` (màquina) → obre el formulari d'ús amb la màquina preomplerta
- `Finalitzar ús` → posa Hora_fi = ara, si estava buida
- `REGISTRAR INCIDÈNCIA` (màquina) → obre el formulari d'incidència preomplert
- `REGISTRAR CONSUM` / `REGISTRAR ENTRADA` (consumible) → obre el moviment amb el tipus Sortida / Entrada preomplert
- `Marcar retornat` (préstec) → Estat = Retornat, si estava Prestat
- `Anar a projecte`, `OBRIR_ACCESS_RAPID` → navegació

**Llistes filtrades (slices)**
- *Préstecs pendents*: Estat = Prestat amb data prevista
- *Préstecs endarrerits*: oberts, sense retorn i data prevista < avui
- *Estoc per reposar*: Estoc_actual < Estoc_minim

**Pantalles principals**: INICI (tauler), Sessions, Projectes, Màquines, Materials, Catàleg, Consum materials, Consumibles, Incidències, Manteniment, Moviments, Préstecs endarrerits, Préstecs pendents, Reposició, Ús de màquines.

**Bots**: *Avís d'estoc mínim* (notificació quan un consumible baixa del mínim) i un bot sense nom que posa préstecs a `Retornat`. El PDF no en documenta el disparador.

---

## 5. Errors i incoherències que cal corregir

1. **MANTENIMENT.Manteniment_ID és una referència a MÀQUINES** amb valor inicial `UNIQUEID()`. Hauria de ser un ID propi. Per això hi ha dues relacions duplicades a Màquines.
2. **PROJECTES.Producte_final** té valor inicial `UNIQUEID()`. Hauria de ser text lliure.
3. **Claus dobles a tot arreu**: `Row ID` és la clau, però també hi ha un `*_ID` amb UNIQUEID. A PROJECTES i USUARIS la clau és una concatenació de tots dos. Les referències són fràgils.
4. **INCIDENCIES.Data_resolució és text llarg**, quan hauria de ser una data. **Element_afectat** és text lliure en lloc d'una referència a màquina, material o espai.
5. El slice de préstecs endarrerits filtra per l'estat `Retard`, que **no existeix** a l'enum.
6. **MOVIMENTS.Usuari** és text lliure, mentre que a la resta de taules l'usuari és el correu.
7. **Preu_total està en `$`**: cal posar `€`.
8. **L'estat de la màquina no s'actualitza sol**: iniciar un ús no la posa `En ús`, i una incidència no la posa `Avaria`.
9. **No hi ha control de solapaments**: dues sessions poden ocupar el mateix espai a la mateixa hora, i dos usos la mateixa màquina.
10. **Valors fixats al codi**: grups (amb un espai de més a `5è A `), categories i noms de rol propis del centre (`Equip motor FAIG`).
11. **Restes de plantilla**: `_Per User Settings` i el bot `New Bot` són sobrants.

---

## 6. Què cal generalitzar per a diversos centres

- **Centre (tenant)**: totes les taules porten `school_id`, i cada centre només veu les seves dades.
- **Mòduls activables per centre**: Espais i sessions · Projectes · Màquines i usos · Manteniment · Incidències · Préstec de material · Consumibles i estoc.
- **Llistes configurables per centre**: grups, categories de màquines, categories de material, categories del catàleg, formats, unitats, tipus d'incidència i de manteniment, periodicitats. Es carreguen amb els valors d'aquest document com a plantilla per defecte.
- **Rols genèrics**:
  - `superadmin`: plataforma
  - `admin`: un per centre; gestiona usuaris, mòduls i llistes
  - `gestor`: equivalent a l'equip motor o directiu
  - `docent`: equivalent a Mestra
  - Cada centre pot posar el nom que vulgui a cada rol.
- **Centre de demostració** amb dades d'exemple, que es reinicia periòdicament.
- **Millores de producte**:
  - estat de màquina automàtic
  - detecció de solapaments en reserves
  - generació automàtica de la propera tasca de manteniment segons la periodicitat
  - avisos d'estoc mínim i de préstecs endarrerits per correu
  - historial per màquina
  - exportació a CSV
  - esborrat lògic (desactivar en lloc d'esborrar)
