const en = {
  dashboard:'Overview',profile:'Profile',devices:'Devices',security:'Sign-in & security',apps:'Apps',
  permissions:'Permissions',storage:'Data usage',files:'Files',friends:'Friends',sharedAppData:'Shared app data',mail:'Mail',settings:'Settings',
  birthday:'Birthday',chooseBirthday:'Choose birthday',useDate:'Use this date',cancel:'Cancel',
};

type Message = keyof typeof en;
const catalogs:Record<string,Partial<Record<Message,string>>> = {
  it:{dashboard:'Panoramica',profile:'Profilo',devices:'Dispositivi',security:'Accesso e sicurezza',apps:'App',
    permissions:'Autorizzazioni',storage:'Utilizzo dei dati',files:'File',friends:'Amici',sharedAppData:'Dati delle app condivisi',mail:'Posta',settings:'Impostazioni',
    birthday:'Data di nascita',chooseBirthday:'Scegli la data di nascita',useDate:'Usa questa data',cancel:'Annulla'},
  es:{dashboard:'Resumen',profile:'Perfil',devices:'Dispositivos',security:'Acceso y seguridad',apps:'Aplicaciones',
    permissions:'Permisos',storage:'Uso de datos',files:'Archivos',friends:'Amigos',sharedAppData:'Datos de aplicaciones compartidos',mail:'Correo',settings:'Ajustes',
    birthday:'Fecha de nacimiento',chooseBirthday:'Elige tu fecha de nacimiento',useDate:'Usar esta fecha',cancel:'Cancelar'},
  fr:{dashboard:'Vue d’ensemble',profile:'Profil',devices:'Appareils',security:'Connexion et sécurité',apps:'Applications',
    permissions:'Autorisations',storage:'Utilisation des données',files:'Fichiers',friends:'Amis',sharedAppData:'Données d’applications partagées',mail:'Messagerie',settings:'Réglages',
    birthday:'Date de naissance',chooseBirthday:'Choisir la date de naissance',useDate:'Utiliser cette date',cancel:'Annuler'},
  de:{dashboard:'Übersicht',profile:'Profil',devices:'Geräte',security:'Anmeldung und Sicherheit',apps:'Apps',
    permissions:'Berechtigungen',storage:'Datennutzung',files:'Dateien',friends:'Freunde',sharedAppData:'Geteilte App-Daten',mail:'E-Mail',settings:'Einstellungen',
    birthday:'Geburtsdatum',chooseBirthday:'Geburtsdatum auswählen',useDate:'Dieses Datum verwenden',cancel:'Abbrechen'},
  pt:{dashboard:'Visão geral',profile:'Perfil',devices:'Dispositivos',security:'Acesso e segurança',apps:'Apps',
    permissions:'Permissões',storage:'Uso de dados',files:'Arquivos',friends:'Amigos',sharedAppData:'Dados de aplicativos compartilhados',mail:'E-mail',settings:'Configurações',
    birthday:'Data de nascimento',chooseBirthday:'Escolher a data de nascimento',useDate:'Usar esta data',cancel:'Cancelar'},
};

export function accountMessage(key:string, fallback:string, locale=Intl.DateTimeFormat().resolvedOptions().locale) {
  if (!Object.hasOwn(en,key)) return fallback;
  const message = key as Message;
  return catalogs[locale.split('-')[0]]?.[message] ?? en[message];
}
