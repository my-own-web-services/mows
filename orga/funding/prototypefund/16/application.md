### Projekttitel \*

My Own Web Services - MOWS

### Hast du einen Account bei GitHub, BitBucket oder einer ähnlichen Plattform? Wenn ja, gib bitte den entsprechenden Link an.

https://git.vindelicum.eu/explore/

### Beschreibe dein Projekt kurz. \*

MOWS soll es für jeden möglich machen, eigene Cloud-Dienste auf eigener Hardware Zuhause, im Büro oder auf gemieteter Hardware in einem Data-Center zu hosten. MOWS soll auf mehreren Maschinen gleichzeitig laufen können, um dadurch Ausfallsicherheit und Skalierbarkeit zu bieten. Probleme, die bei jedem IT-System auftreten wie Backups, App und Systeminstallation, Sicherheit uvm. sollen eine vorgefertigte Lösung bekommen. MOWS soll die Offenheit von Linux mit der gut integrierten Architektur von Apple verbinden und einen ganzheitlichen Ansatz verfolgen. MOWS soll Developern grundlegende Web-APIs zur App-Entwicklung zur Verfügung stellen, welche normalerweise nur bei großen Firmen zu finden sind.

### Welchem Themenfeld ordnest du dein Projekt zu? \*

Softwareinfrastruktur

### Welche gesellschaftliche Herausforderung willst du mit dem Projekt angehen? \*

Das Internet ist zentralisiert wie nie zuvor, wodurch viele Probleme entstehen. Einige wenige Firmen haben die Macht über das gesamte IT-Ökosystem. Für Individuen werden Dinge wie Privatsphäre, Souveränität, freie Meinungsäußerung uvm. weiter und weiter eingeschränkt. Auch Unternehmen müssen sich wegen mangelnder Alternativen zunehmend auf die Dienste und Preise großer Firmen einlassen. Diese Firmen werden weiter Daten ihrer Kunden sammeln und verkaufen, solange diese in deren virtuellen Mauern eingesperrt sind.

Die meisten Open-Source-Lösungen für Standardaufgaben haben in der alten IT-Welt gute Dienste geleistet, wurden aber mit der Nutzung von mehreren Computern pro Person, sowie mit der papierlosen Zusammenarbeit zunehmend obsolet. Die großen Tech-Firmen haben das früh verstanden und bieten seither gut vernetzte Lösungen an, die jedoch stark eingeschränkt sind.

MOWS soll alle Basics für ein einfaches, selbstbestimmtes, privates, zuverlässiges und durchdachtes IT-Ökosystem liefern, um diesen Problemen zu begegnen.

### Wie willst du dein Projekt technisch umsetzen? \*

Die Kernkomponente des Projekts bildet eine Systemanwendung (MOWS Operator), die das zugrundeliegende System steuert und den Lifecycle sowie die Ressourcenverteilung von Containern oder VM-Anwendungen kontrolliert.

Kubernetes so wie andere Open Source Bausteine wie Longhorn, Cilium, Kube-VIP, Traefik ein DNS-Server u.a. werden kombiniert, um mit dem MOWS Operator ein vollständiges verteiltes System zu schaffen.

Jede App, die auf dem System installiert werden soll, ist per Default komplett isoliert. Über eine Manifest-Datei kann die App bei der Installation zusätzliche Ressourcen erbitten, welche der Administrator genehmigen muss und welche dann vom System vergeben werden. Das System übernimmt auch die Konfiguration der App hinsichtlich der notwendigen DNS-Einträge, dem Reverse Proxy Setup und der Erstellung von z.B. Nutzeraccounts, welche benötigt werden.

Den Großteil der Nutzung sollen Web-Apps bilden, welche vorgefertigte APIs verwenden können. Auch traditionelle Betriebssysteme können zentral vom Server gestreamt werden.

### Hast du schon an der Idee gearbeitet? Wenn ja, beschreibe kurz den aktuellen Stand und erkläre die geplanten Neuerungen. \*

Seit Anfang dieses Jahres beschäftige ich mich mit der technischen Konzeption, mit Versuchen von Teilkomponenten und deren Nutzbarkeit. Nachdem die größten Fragen geklärt waren, habe ich angefangen, an der Implementierung des Installers zu arbeiten. Dieser installiert das Betriebssystem(Linux, Kubernetes etc.) automatisch auf einer VM, auf einem remote vServer oder eigener Hardware, um die Basis für alles Weitere zu schaffen. Eine Web-API die Developern und Nutzern das Management, die Konvertierung, Anzeige und Suche von Dateien ermöglicht, hatte ich bereits begonnen zu entwickeln, wurde dann aber davon abgehalten, da ich zunächst eine gute Basis für diese und andere APIs schaffen wollte.

### Link zum bestehenden Projekt (falls vorhanden)

Website: https://mows.vindelicum.eu/
Repository: https://git.vindelicum.eu/firstdorsal/mows

### Welche ähnlichen Ansätze gibt es schon und was wird dein Projekt anders bzw. besser machen? \*

Es gibt einige Teilkomponenten für verschiedene Bereiche des Projekts:

Nextcloud:

-   Bietet kein Ökosystem, um komplexere Anwendungen zu realisieren
-   Muss kompliziert manuell installiert werden
-   Lästige Nutzung und Administration

Proxmox:

-   Kompliziert
-   Keine einfachen Multi-Container-Setups möglich
-   Kleineres Ökosystem als Kubernetes

umbrelOS, casaOS, Cloudron:

-   Unterstützt nur einzelne Computer
-   Keine integrierten Lösungen für Backups o.ä.
-   Viel manuelles Setup
-   Wenig Ressourcen-Isolation

### Wer ist die Zielgruppe und wie soll dein Projekt sie erreichen? \*

Die erste Zielgruppe ist die wachsende Menge an Homelab Enthusiasten. Erreicht werden soll diese mit Videos, Vorstellungen durch Content-Creator aus diesem Bereich, Social Media Posts und die Website.

Da das System im Vergleich zu anderen von Anfang an so konzipiert wurde, dass es durch seine Architektur eine Nutzung nicht nur für Heimanwender, sondern auch für den professionellen Einsatz ermöglicht, welche die zweite Zielgruppe bilden.

Ideal wäre der Einsatz auch für Schulen, Universitäten und andere öffentliche Einrichtungen.

Die vielfältige Nutzbarkeit und Offenheit bewirkt, dass es sich deutlich mehr lohnt, Software für dieses System zu entwickeln als für die Anbieter gebundenen.

### An welchen Software-Projekten hast du / habt ihr bisher gearbeitet? Bei Open-Source-Projekten bitte einen Link zum Repository angeben.

Queer Augsburg - Website und Mitgliedermanagement

https://git.vindelicum.eu/firstdorsal/queer-augsburg

https://queer-augsburg.de/

Pektin - DNS-Server uvm.

https://git.vindelicum.eu/pektin/pektin-api

Ein eigener DNS-Server mit API, UI, ACME TLS Zertifikat Erstellung, einem Reverse Proxy, DNSSEC signing über Vault uvm.

Verkehr - Rust rewrite des Reverse Proxies traefik

https://git.vindelicum.eu/pektin/pektin-verkehr

### Erfahrung, Hintergrund, Motivation, Perspektive: Was sollen wir über dich (bzw. euch) wissen und bei der Auswahl berücksichtigen? \*

Ich habe vor vielen Jahren angefangen, meine eigene Website zu betreiben, was zunächst auch sehr einfach war. Mit der Zeit habe ich mich immer mehr für Privatsphäre u.ä. interessiert (auch weil ich Teil der queeren Community bin) und bemerkt, wie schwierig es ist, eine Website zu veröffentlichen, ohne Nutzerdaten an Dritte zu geben. Trotz des Aufwands mache ich das seit einigen Jahren mit Erfolg. Alle Links oben sowie meine Mail, Nextcloud, usw. funktionieren über meinen eigenen Server im Nebenzimmer. Da ich System-Administrationsaufgaben hasse, will ich den Aufwand für mich und alle anderen minimieren.

### Bewerbt ihr euch als Team um die Förderung? \*

Ja
Nein

### Namen der Teammitglieder

Limit this field to 30 words.

### Wie viele Stunden willst du (bzw. will das Team) in den 6 Monaten Förderzeitraum insgesamt an der Umsetzung arbeiten? \*

Bitte eine Zahl eintragen - max. 950 h.
Die Maximalförderung von 47.500€ leitet sich aus einer Vollzeitstelle für eine Person für ein halbes Jahr (ca. 950 h) ab. Dies entspricht einem Stundensatz von 50 €. Wer einen höheren Stundensatz abrufen will, muss mit Rechnungen belegen, diese bereits als Entwickler\*in abgerufen zu haben. Die Stundenanzahl und die entsprechende Finanzierung darf natürlich auch zwischen mehreren Teammitgliedern aufgeteilt werden. Alle Förderprojekte einer Runde haben Anspruch auf die maximale Fördersumme, eine hohe Stundenzahl beeinflusst also nicht die Auswahl.

### Skizziere kurz die wichtigsten Meilensteine, die im Förderzeitraum umgesetzt werden sollen. \*

Fertigstellung des MOWS Manager (Installer):

-   Setup des Clusters primär in VMs für die weitere Entwicklung des MOWS Controllers (Systemanwendung auf dem Cluster)
-   Setup eines remote VPS, um dessen statische IP für den Cluster zu verwenden (Wichtig für Mail und DNS-Server)

Erstellung eines Prototyps für den MOWS Controller auf dem Cluster:

-   Ausarbeitung der Struktur des Manifests, über welches Apps installiert werden können
-   Kontrolle der wichtigsten APIs auf Basis des Manifests
-   Erste Anwendungen zum Laufen bringen

### Ich habe die Checkliste für Bewerber*innen gelesen. *

on

### Ich habe die Informationen zum Datenschutz gelesen und stimme der Verwendung meiner Daten im Rahmen der Programmziele des Prototype Funds zu. \*

on

### Ich bin über 18 Jahre alt und habe meinen Hauptwohnsitz in Deutschland. \*

on

### Ich bin damit einverstanden, die Projektergebnisse unter einer Open-Source-Lizenz (z. B. MIT-Lizenz), öffentlich zugänglich (z. B. über Github oder BitBucket) zur Verfügung zu stellen. \*

on
