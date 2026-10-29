# Fiche Chrome Web Store (Français)

## Nom (45 caractères max.)
Tab Matomen Kai – Espaces d'onglets

## Résumé (132 caractères max.)
Un « espace » par projet, changez d'ensemble d'onglets d'un coup. Enregistrer, restaurer, actions groupées, annuler. 10 langues.

## Description détaillée
Tab Matomen Kai enregistre vos onglets sous forme d'« espaces », un par projet ou tâche, et vous permet de changer tout l'ensemble d'onglets dans la même fenêtre Chrome.

■ Ce que vous pouvez faire
- Espaces : enregistrez un ensemble d'onglets par projet et changez en un clic. Vous pouvez aussi enregistrer automatiquement les onglets actuels lors du changement.
- Catégories : organisez les espaces en hiérarchie. Déplacez-les par glisser-déposer et distinguez-les par couleur et par icône.
- Groupes d'onglets : les groupes d'onglets de Chrome sont enregistrés et restaurés tels quels.
- Actions groupées : sélectionnez des onglets pour les ouvrir, les déplacer, les grouper, les archiver ou les supprimer. Tout sélectionner et plages avec Maj+clic.
- Annuler : annulez une suppression ou un archivage juste après (Ctrl/⌘+Z).
- Copier des listes d'URL : en Markdown, titre + URL ou URL seules, directement dans le presse-papiers.
- Enregistrement par clic droit : enregistrez la page ou le lien sous le curseur dans n'importe quel espace depuis le menu contextuel.
- Clavier : Ctrl/⌘+S enregistrer, Ctrl/⌘+K rechercher des espaces, / filtrer les onglets.
- Sauvegarde : export/import JSON, sauvegardes automatiques planifiées et sauvegarde manuelle sur Google Drive.
- 10 langues : anglais, japonais, chinois simplifié, chinois traditionnel, coréen, espagnol, portugais (Brésil), allemand, français et italien. Changez dans les Paramètres.

■ Vos données
Tout est stocké dans le stockage local de votre navigateur. La sauvegarde sur Google Drive n'écrit dans votre propre Drive que lorsque vous cliquez sur « Se connecter » et « Sauvegarder maintenant ». Rien de ce que vous consultez n'est envoyé où que ce soit.

■ Édition Pro
La plupart des fonctions sont gratuites. L’édition Pro (300 ¥ par mois) ajoute la sauvegarde automatique sur Google Drive. Achat et résiliation dans Paramètres → Pro. Pour vérifier l’achat, seul un identifiant d’achat aléatoire propre à votre installation est envoyé à notre serveur (ni nom, ni e-mail, ni données de navigation). Le paiement est traité par Stripe, Link apparaissant comme vendeur.

## Justification des autorisations (pour le tableau de bord développeur)
- tabs / tabGroups : lire les onglets et groupes d'onglets ouverts pour les enregistrer et les restaurer sous forme d'espaces.
- storage / unlimitedStorage : conserver les espaces et les paramètres en local.
- alarms : sauvegardes automatiques planifiées.
- downloads : écrire les sauvegardes JSON dans le dossier Téléchargements.
- contextMenus : le menu contextuel « Enregistrer dans Tab Matomen Kai ».
- identity : autoriser l'enregistrement des sauvegardes sur Google Drive (portée drive.file uniquement).
- Autorisation d'hôte googleapis.com : envoi vers l'API Google Drive. 127.0.0.1 : communication avec le serveur d'intégration d'IA local facultatif sur le PC de l'utilisateur.
- Script de contenu (tous les sites) : écoute uniquement le bouton de souris configuré pour revenir au tableau de bord. Il ne lit pas le contenu des pages.
