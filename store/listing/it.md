# Scheda Chrome Web Store (Italiano)

## Nome (max 45 caratteri)
Tab Matomen Kai – Spazi di schede

## Riepilogo (max 132 caratteri)
Uno «spazio» per progetto, cambia serie di schede in una finestra. Salva, ripristina, azioni multiple, annulla. 10 lingue.

## Descrizione dettagliata
Tab Matomen Kai salva le tue schede come «spazi», uno per progetto o attività, e ti permette di cambiare l'intero insieme di schede nella stessa finestra di Chrome.

■ Cosa puoi fare
- Spazi: salva un insieme di schede per progetto e cambia con un clic. Se vuoi, salva automaticamente le schede attuali quando cambi spazio.
- Categorie: organizza gli spazi in una gerarchia. Trascina per spostarli e distinguili per colore e icona.
- Gruppi di schede: i gruppi di schede di Chrome vengono salvati e ripristinati così come sono.
- Azioni multiple: seleziona le schede per aprirle, spostarle, raggrupparle, archiviarle o eliminarle. Seleziona tutto e intervalli con Maiusc+clic.
- Annulla: annulla un'eliminazione o un'archiviazione subito dopo averla eseguita (Ctrl/⌘+Z).
- Copia elenchi di URL: in Markdown, titolo + URL o solo URL, direttamente negli appunti.
- Salvataggio con clic destro: salva la pagina o il link sotto il cursore in qualsiasi spazio dal menu contestuale.
- Tastiera: Ctrl/⌘+S salva, Ctrl/⌘+K cerca spazi, / filtra le schede.
- Backup: esportazione/importazione JSON, backup automatici programmati e backup manuale su Google Drive.
- 10 lingue: inglese, giapponese, cinese semplificato, cinese tradizionale, coreano, spagnolo, portoghese (Brasile), tedesco, francese e italiano. Cambia lingua nelle Impostazioni.

■ I tuoi dati
Tutto è memorizzato nell'archiviazione locale del tuo browser. Il backup su Google Drive scrive nel tuo Drive solo quando premi «Connetti» e «Esegui il backup ora». Nulla di ciò che navighi viene inviato altrove.

■ Edizione Pro
La maggior parte delle funzioni è gratuita. L’edizione Pro (acquisto una tantum, 300 ¥) aggiunge il backup automatico su Google Drive. Si acquista da Impostazioni → Pro; nessun addebito ricorrente. Per verificare l’acquisto viene inviato al nostro server solo un ID di acquisto casuale creato per la tua installazione (niente nome, email o dati di navigazione). Il pagamento è gestito da Stripe, con Link come venditore.

## Motivazioni delle autorizzazioni (per la dashboard dello sviluppatore)
- tabs / tabGroups: leggere le schede e i gruppi di schede aperti per salvarli e ripristinarli come spazi.
- storage / unlimitedStorage: conservare spazi e impostazioni in locale.
- alarms: backup automatici programmati.
- downloads: scrivere i backup JSON nella cartella Download.
- contextMenus: il menu contestuale «Salva in Tab Matomen Kai».
- identity: autorizzare il salvataggio dei backup su Google Drive (solo l'ambito drive.file).
- Autorizzazione host googleapis.com: caricamento sull'API di Google Drive. 127.0.0.1: comunicazione con il server di integrazione IA locale facoltativo sul PC dell'utente.
- Script di contenuto (tutti i siti): rimane in ascolto solo del pulsante del mouse configurato per tornare alla dashboard. Non legge il contenuto delle pagine.
