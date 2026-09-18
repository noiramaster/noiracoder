/* i18n NoiraCoder — MISMO mecanismo que noiramaster/noirax-clean (src/lib/i18n.ts):
 * LOCALES ['en','es','pt','fr','de','it','ar'], RTL ['ar'], DEFAULT 'en',
 * STORAGE_KEY 'noira-lang', t(claveConPuntos) con fallback a EN.
 * Versión vanilla (sitio estático): aplica vía atributos [data-i18n].
 */
var NOIRA_LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ar'];
var NOIRA_RTL = ['ar'];
var NOIRA_DEFAULT = 'en';
var NOIRA_STORAGE_KEY = 'noira-lang';
var NOIRA_LANG_LABELS = { en: 'EN', es: 'ES', pt: 'PT', fr: 'FR', de: 'DE', it: 'IT', ar: 'AR' };

var NOIRA_EN = {
  nav: { home: 'Home', docs: 'Docs', skills: 'Skills', tutorials: 'Tutorials', blog: 'Blog', contact: 'Contact', about: 'About', legal: 'Legal', terms: 'Terms', privacy: 'Privacy', login: 'Log in', signup: 'Get started' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'A coding agent with memory.',
    desc: 'NoiraCoder lives in your terminal: it remembers your project between sessions, rotates across free models when one runs out, and keeps your keys encrypted on your machine. No card. No mandatory cloud.',
    typing: '> npm install -g noiracoder',
    term1: '> Systems online: memory · free rotation · local privacy',
    term2: '> All systems available',
    ctaStart: 'Start in 1 min',
    ctaKeys: 'Connect 3 free keys'
  },
  diff: {
    title: 'Differences', kicker: 'Why NoiraCoder',
    sub: 'What changes day to day versus a generic chatbot glued to your editor.',
    c1t: '01 · 3-level memory', c1d: 'Project (AGENTS.md), session and persistent decisions in .noirarc/memory/. Come back tomorrow and the agent still knows how you build and what you forbade.',
    c2t: '02 · Smart free rotation', c2d: 'One OpenRouter + Groq + Zen key = combined budget. If a model runs out, fails or loses its key, it switches alone to another provider with a valid key.',
    c3t: '03 · Local privacy', c3d: 'DPAPI-encrypted keys on your machine, server bound to 127.0.0.1 with token, whitelist sandbox that denies rm -rf / even if you confirm.'
  },
  install: {
    title: 'Install', kicker: 'Minimal install',
    sub: 'You need Node 20+. No Docker, no mandatory account to start.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'Connect free (1 min per key)'
  },
  skills: { title: 'Skills', kicker: 'Built-in skills', sub: '10 specialists, zero plugins. Full documentation:', all: 'Full documentation' },
  cmds: {
    title: 'Daily use', kicker: 'Five commands and go',
    h1: 'Command', h2: 'What it does',
    r1: 'Opens the interactive TUI (real-time streaming).',
    r2: 'Runs one task and exits. Ideal for scripts.',
    r3: 'Connects a key (opens the browser, 1 click).',
    r4: '3-free-keys guide + real validation.',
    r5: 'Local API on 127.0.0.1 to integrate with your editor.',
    more: 'Inside the session:'
  },
  teasers: {
    review: 'Reviews before applying: effects, risks, tests.',
    security: 'Mandatory in sensitive zones: secrets, funds, infra.',
    debug: 'Reproduces, isolates, fixes with real error evidence.',
    testing: 'Designs cases that would fail without the fix, no theater.',
    refactor: 'Cleanup without behavior change, green tests.',
    perf: 'Measures before and after; no number, no improvement.'
  },
  contactCta: 'Contact Noira',
  footer: {
    brand: 'Terminal coding agent: memory, free rotation, local privacy.',
    products: 'Ecosystem', resources: 'Resources', community: 'Community', languages: 'Languages',
    viewAll: 'All posts', faq: 'FAQ',
    copyright: 'All rights reserved.'
  },
  blog: { title: 'Blog', sub: 'Build notes: how it works inside and how to squeeze it.', readMore: 'Read more', auto: 'New posts are generated automatically every day.' },
  contact: {
    title: 'Contact', intro: 'Questions, suggestions or collaborations? Write to us.',
    form: 'Send message', name: 'Your name', message: 'Your message...', send: 'Send', sent: '✓ Message sent successfully',
    email: 'Email', emailDesc: 'For any general question, support or collaboration:',
    social: 'Social', socialDesc: 'You can also find us on:',
    products: 'Products', productsDesc: 'If your question is about a specific product, contact it directly:'
  },
  legal: { updated: 'Last updated:' }
};

var NOIRA_ES = {
  nav: { home: 'Inicio', docs: 'Docs', skills: 'Skills', tutorials: 'Tutoriales', blog: 'Blog', contact: 'Contacto', about: 'Sobre NoiraCoder', legal: 'Legal', terms: 'Términos', privacy: 'Privacidad', login: 'Entrar', signup: 'Empezar' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'Un agente de código con memoria.',
    desc: 'NoiraCoder vive en tu terminal: recuerda tu proyecto entre sesiones, rota entre modelos gratuitos cuando uno se agota y guarda tus claves cifradas en tu máquina. Sin tarjeta. Sin nube obligatoria.',
    typing: '> npm install -g noiracoder',
    term1: '> Sistemas en línea: memoria · rotación free · privacidad local',
    term2: '> Todos los sistemas disponibles',
    ctaStart: 'Empezar en 1 min',
    ctaKeys: 'Conectar 3 claves free'
  },
  diff: {
    title: 'Diferencias', kicker: 'Por qué NoiraCoder',
    sub: 'Lo que cambia el día a día frente a un chatbot genérico pegado al editor.',
    c1t: '01 · Memoria de 3 niveles', c1d: 'Proyecto (AGENTS.md), sesión y decisiones persistentes en .noirarc/memory/. Vuelves mañana y el agente sigue sabiendo cómo compilas y qué prohibiste.',
    c2t: '02 · Rotación free inteligente', c2d: 'Una clave de OpenRouter + Groq + Zen = presupuesto combinado. Si un modelo se agota, falla o pierde la key, rota solo a otro proveedor con clave válida.',
    c3t: '03 · Privacidad local', c3d: 'Claves cifradas con DPAPI en tu máquina, servidor atado a 127.0.0.1 con token, sandbox con whitelist que niega rm -rf / aunque confirmes.'
  },
  install: {
    title: 'Instalar', kicker: 'Instalación mínima',
    sub: 'Necesitas Node 20+. Sin Docker, sin cuenta obligatoria para empezar.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'Conecta gratis (1 min por clave)'
  },
  skills: { title: 'Skills', kicker: 'Skills integradas', sub: '10 especialistas, cero plugins. Documentación completa:', all: 'Documentación completa' },
  cmds: {
    title: 'Uso diario', kicker: 'Cinco comandos y a trabajar',
    h1: 'Comando', h2: 'Qué hace',
    r1: 'Abre la TUI interactiva (streaming en tiempo real).',
    r2: 'Ejecuta una tarea y sale. Ideal para scripts.',
    r3: 'Conecta una clave (abre el navegador, 1 clic).',
    r4: 'Guía de las 3 claves gratuitas + validación real.',
    r5: 'API local en 127.0.0.1 para integrar con tu editor.',
    more: 'Dentro de la sesión:'
  },
  teasers: {
    review: 'Revisión antes de aplicar: efectos, riesgos, tests.',
    security: 'Obligatoria en zonas sensibles: secretos, fondos, infra.',
    debug: 'Reproduce, aísla, corrige con evidencia del error real.',
    testing: 'Diseña casos que fallarían sin el fix, no teatro.',
    refactor: 'Limpieza sin cambiar comportamiento, con tests verdes.',
    perf: 'Mide antes y después; sin número no hay mejora.'
  },
  cmds: { title: 'Uso diario', kicker: 'Cinco comandos y a trabajar' },
  contactCta: 'Contactar con Noira',
  footer: {
    brand: 'Agente de código en terminal: memoria, rotación free, privacidad local.',
    products: 'Ecosistema', resources: 'Recursos', community: 'Comunidad', languages: 'Idiomas',
    viewAll: 'Ver todos', faq: 'FAQ',
    copyright: 'Todos los derechos reservados.'
  },
  blog: { title: 'Blog', sub: 'Notas de construcción: cómo funciona por dentro y cómo exprimirlo.', readMore: 'Leer más', auto: 'Cada día se genera un post automáticamente.' },
  contact: {
    title: 'Contacto', intro: '¿Preguntas, sugerencias o colaboraciones? Escríbenos.',
    form: 'Enviar mensaje', name: 'Tu nombre', message: 'Tu mensaje...', send: 'Enviar', sent: '✓ Mensaje enviado correctamente',
    email: 'Email', emailDesc: 'Para cualquier consulta general, soporte o colaboración:',
    social: 'Redes sociales', socialDesc: 'También puedes encontrarnos en:',
    products: 'Productos', productsDesc: 'Si tu consulta es sobre un producto concreto, contacta directamente:'
  },
  legal: { updated: 'Última actualización:' }
};

var NOIRA_PT = {
  nav: { home: 'Início', docs: 'Docs', skills: 'Skills', tutorials: 'Tutoriais', blog: 'Blog', contact: 'Contato', about: 'Sobre', legal: 'Aviso Legal', terms: 'Termos', privacy: 'Privacidade', login: 'Entrar', signup: 'Começar' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'Um agente de código com memória.',
    desc: 'NoiraCoder vive no seu terminal: lembra seu projeto entre sessões, alterna entre modelos gratuitos quando um acaba e mantém suas chaves criptografadas na sua máquina. Sem cartão. Sem nuvem obrigatória.',
    typing: '> npm install -g noiracoder',
    term1: '> Sistemas online: memória · rotação free · privacidade local',
    term2: '> Todos os sistemas disponíveis',
    ctaStart: 'Começar em 1 min',
    ctaKeys: 'Conectar 3 chaves free'
  },
  diff: {
    title: 'Diferenças', kicker: 'Por que NoiraCoder',
    sub: 'O que muda no dia a dia frente a um chatbot genérico colado ao editor.',
    c1t: '01 · Memória de 3 níveis', c1d: 'Projeto (AGENTS.md), sessão e decisões persistentes em .noirarc/memory/. Volte amanhã e o agente ainda sabe como você compila e o que proibiu.',
    c2t: '02 · Rotação free inteligente', c2d: 'Uma chave OpenRouter + Groq + Zen = orçamento combinado. Se um modelo acaba, falha ou perde a chave, alterna sozinho para outro provedor com chave válida.',
    c3t: '03 · Privacidade local', c3d: 'Chaves criptografadas com DPAPI na sua máquina, servidor atado a 127.0.0.1 com token, sandbox com whitelist que nega rm -rf / mesmo se você confirmar.'
  },
  install: {
    title: 'Instalar', kicker: 'Instalação mínima',
    sub: 'Você precisa de Node 20+. Sem Docker, sem conta obrigatória para começar.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'Conecte grátis (1 min por chave)'
  },
  skills: { title: 'Skills', kicker: 'Skills integradas', sub: '10 especialistas, zero plugins. Documentação completa:', all: 'Documentação completa' },
  cmds: {
    title: 'Uso diário', kicker: 'Cinco comandos e pronto',
    h1: 'Comando', h2: 'O que faz',
    r1: 'Abre a TUI interativa (streaming em tempo real).',
    r2: 'Executa uma tarefa e sai. Ideal para scripts.',
    r3: 'Conecta uma chave (abre o navegador, 1 clique).',
    r4: 'Guia das 3 chaves gratuitas + validação real.',
    r5: 'API local em 127.0.0.1 para integrar com seu editor.',
    more: 'Dentro da sessão:'
  },
  teasers: {
    review: 'Revisão antes de aplicar: efeitos, riscos, testes.',
    security: 'Obrigatória em zonas sensíveis: segredos, fundos, infra.',
    debug: 'Reproduz, isola, corrige com evidência do erro real.',
    testing: 'Projetaria casos que falhariam sem o fix, sem teatro.',
    refactor: 'Limpeza sem mudar comportamento, testes verdes.',
    perf: 'Mede antes e depois; sem número não há melhoria.'
  },
  contactCta: 'Contactar Noira',
  footer: {
    brand: 'Agente de código no terminal: memória, rotação free, privacidade local.',
    products: 'Ecossistema', resources: 'Recursos', community: 'Comunidade', languages: 'Idiomas',
    viewAll: 'Ver todos', faq: 'Perguntas Frequentes',
    copyright: 'Todos os direitos reservados.'
  },
  blog: { title: 'Blog', sub: 'Notas de construção: como funciona por dentro e como aproveitar.', readMore: 'Ler mais', auto: 'Novos posts são gerados automaticamente todo dia.' },
  contact: {
    title: 'Contato', intro: 'Dúvidas, sugestões ou colaborações? Escreva para nós.',
    form: 'Enviar mensagem', name: 'Seu nome', message: 'Sua mensagem...', send: 'Enviar', sent: '✓ Mensagem enviada com sucesso',
    email: 'E-mail', emailDesc: 'Para qualquer dúvida geral, suporte ou colaboração:',
    social: 'Social', socialDesc: 'Você também pode nos encontrar em:',
    products: 'Produtos', productsDesc: 'Se sua dúvida é sobre um produto específico, contacte diretamente:'
  },
  legal: { updated: 'Última atualização:' }
};

var NOIRA_FR = {
  nav: { home: 'Accueil', docs: 'Docs', skills: 'Skills', tutorials: 'Tutoriels', blog: 'Blog', contact: 'Contact', about: 'À propos', legal: 'Mentions Légales', terms: 'Conditions', privacy: 'Confidentialité', login: 'Connexion', signup: 'Commencer' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'Un agent de code avec mémoire.',
    desc: 'NoiraCoder vit dans votre terminal : il se souvient de votre projet entre les sessions, alterne entre des modèles gratuits quand un s\'épuise et garde vos clés chiffrées sur votre machine. Sans carte. Sans cloud obligatoire.',
    typing: '> npm install -g noiracoder',
    term1: '> Systèmes en ligne : mémoire · rotation free · confidentialité locale',
    term2: '> Tous les systèmes disponibles',
    ctaStart: 'Commencer en 1 min',
    ctaKeys: 'Connecter 3 clés free'
  },
  diff: {
    title: 'Différences', kicker: 'Pourquoi NoiraCoder',
    sub: 'Ce qui change au quotidien face à un chatbot générique collé à l\'éditeur.',
    c1t: '01 · Mémoire à 3 niveaux', c1d: 'Projet (AGENTS.md), session et décisions persistantes dans .noirarc/memory/. Revenez demain et l\'agent sait toujours comment vous compilez et ce que vous avez interdit.',
    c2t: '02 · Rotation free intelligente', c2d: 'Une clé OpenRouter + Groq + Zen = budget combiné. Si un modèle s\'échoue ou perd sa clé, bascule seul vers un autre fournisseur avec une clé valide.',
    c3t: '03 · Confidentialité locale', c3d: 'Clés chiffrées au DPAPI sur votre machine, serveur lié à 127.0.0.1 avec token, sandbox avec whitelist qui refuse rm -rf / même si vous confirmez.'
  },
  install: {
    title: 'Installer', kicker: 'Installation minimale',
    sub: 'Vous avez besoin de Node 20+. Pas de Docker, pas de compte obligatoire pour commencer.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'Connectez gratuitement (1 min par clé)'
  },
  skills: { title: 'Skills', kicker: 'Skills intégrées', sub: '10 spécialistes, zéro plugins. Documentation complète :', all: 'Documentation complète' },
  cmds: {
    title: 'Usage quotidien', kicker: 'Cinq commandes et c\'est parti',
    h1: 'Commande', h2: 'Ce qu\'il fait',
    r1: 'Ouvre la TUI interactive (streaming en temps réel).',
    r2: 'Exécute une tâche et sort. Idéal pour les scripts.',
    r3: 'Connecte une clé (ouvre le navigateur, 1 clic).',
    r4: 'Guide des 3 clés gratuites + validation réelle.',
    r5: 'API locale sur 127.0.0.1 pour intégrer avec votre éditeur.',
    more: 'Dans la session :'
  },
  teasers: {
    review: 'Revue avant d\'appliquer : effets, risques, tests.',
    security: 'Obligatoire dans les zones sensibles : secrets, fonds, infra.',
    debug: 'Reproduit, isole, corrige avec preuve de l\'erreur réelle.',
    testing: 'Conçoit des cas qui échoueraient sans le fix, pas de théâtre.',
    refactor: 'Nettoyage sans changement de comportement, tests verts.',
    perf: 'Mesure avant et après ; pas de nombre, pas d\'amélioration.'
  },
  contactCta: 'Contacter Noira',
  footer: {
    brand: 'Agent de code dans le terminal : mémoire, rotation free, confidentialité locale.',
    products: 'Écosystème', resources: 'Ressources', community: 'Communauté', languages: 'Langues',
    viewAll: 'Voir tout', faq: 'FAQ',
    copyright: 'Tous droits réservés.'
  },
  blog: { title: 'Blog', sub: 'Notes de construction : comment ça fonctionne et comment l\'exploiter.', readMore: 'Lire la suite', auto: 'De nouveaux articles sont générés automatiquement chaque jour.' },
  contact: {
    title: 'Contact', intro: 'Questions, suggestions ou collaborations ? Écrivez-nous.',
    form: 'Envoyer le message', name: 'Votre nom', message: 'Votre message...', send: 'Envoyer', sent: '✓ Message envoyé avec succès',
    email: 'E-mail', emailDesc: 'Pour toute question générale, support ou collaboration :',
    social: 'Social', socialDesc: 'Vous pouvez aussi nous trouver sur :',
    products: 'Produits', productsDesc: 'Si votre question concerne un produit spécifique, contactez-le directement :'
  },
  legal: { updated: 'Dernière mise à jour :' }
};

var NOIRA_DE = {
  nav: { home: 'Startseite', docs: 'Docs', skills: 'Skills', tutorials: 'Tutorials', blog: 'Blog', contact: 'Kontakt', about: 'Über uns', legal: 'Impressum', terms: 'AGB', privacy: 'Datenschutz', login: 'Anmelden', signup: 'Loslegen' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'Ein Code-Agent mit Gedächtnis.',
    desc: 'NoiraCoder lebt in deinem Terminal: erinnert sich an dein Projekt zwischen Sitzungen, wechselt zwischen kostenlosen Modellen, wenn eines aufgebraucht ist, und hält deine Schlüssel auf deiner Maschine verschlüsselt. Ohne Karte. Ohne obligatorische Cloud.',
    typing: '> npm install -g noiracoder',
    term1: '> Systeme online: Gedächtnis · kostenlose Rotation · lokale Privatsphäre',
    term2: '> Alle Systeme verfügbar',
    ctaStart: 'In 1 Min starten',
    ctaKeys: '3 kostenlose Schlüssel verbinden'
  },
  diff: {
    title: 'Unterschiede', kicker: 'Warum NoiraCoder',
    sub: 'Was sich im Alltag gegenüber einem generischen Chatbot ändert.',
    c1t: '01 · 3-Stufen-Gedächtnis', c1d: 'Projekt (AGENTS.md), Sitzung und persistente Entscheidungen in .noirarc/memory/. Komm morgen wieder und der Agent weiß immer noch, wie du baust und was du verboten hast.',
    c2t: '02 · Intelligente kostenlose Rotation', c2d: 'Ein OpenRouter + Groq + Zen Schlüssel = kombiniertes Budget. Wenn ein Modell versagt oder seinen Schlüssel verliert, wechselt es allein zu einem anderen Anbieter mit gültigem Schlüssel.',
    c3t: '03 · Lokale Privatsphäre', c3d: 'DPAPI-verschlüsselte Schlüssel auf deiner Maschine, Server gebunden an 127.0.0.1 mit Token, Sandbox mit Whitelist die rm -rf / ablehnt, selbst wenn du bestätigst.'
  },
  install: {
    title: 'Installieren', kicker: 'Minimale Installation',
    sub: 'Du brauchst Node 20+. Kein Docker, kein obligatorisches Konto zum Starten.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'Kostenlos verbinden (1 Min pro Schlüssel)'
  },
  skills: { title: 'Skills', kicker: 'Integrierte Skills', sub: '10 Spezialisten, null Plugins. Vollständige Dokumentation:', all: 'Vollständige Dokumentation' },
  cmds: {
    title: 'Tägliche Nutzung', kicker: 'Fünf Kommandos und los',
    h1: 'Kommando', h2: 'Was es macht',
    r1: 'Öffnet die interaktive TUI (Echtzeit-Streaming).',
    r2: 'Führt eine Aufgabe aus und beendet sich. Ideal für Skripte.',
    r3: 'Verbindet einen Schlüssel (öffnet den Browser, 1 Klick).',
    r4: '3-kostenlose-Schlüssel-Leitfaden + echte Validierung.',
    r5: 'Lokale API auf 127.0.0.1 zur Integration mit deinem Editor.',
    more: 'Innerhalb der Sitzung:'
  },
  teasers: {
    review: 'Überprüfung vor dem Anwenden: Effekte, Risiken, Tests.',
    security: 'Pflicht in sensiblen Zonen: Geheimnisse, Gelder, Infra.',
    debug: 'Reproduziert, isoliert, behebt mit echtem Fehlerbeweis.',
    testing: 'Entwirft Fälle, die ohne den Fix fehlgeschlagen wären, kein Theater.',
    refactor: 'Aufräumen ohne Verhaltensänderung, grüne Tests.',
    perf: 'Misst vor und nachher; keine Zahl, keine Verbesserung.'
  },
  contactCta: 'Noira kontaktieren',
  footer: {
    brand: 'Code-Agent im Terminal: Gedächtnis, kostenlose Rotation, lokale Privatsphäre.',
    products: 'Ökosystem', resources: 'Ressourcen', community: 'Community', languages: 'Sprachen',
    viewAll: 'Alle ansehen', faq: 'Häufige Fragen',
    copyright: 'Alle Rechte vorbehalten.'
  },
  blog: { title: 'Blog', sub: 'Baunotizen: wie es innen funktioniert und wie man es optimal nutzt.', readMore: 'Weiterlesen', auto: 'Neue Beiträge werden täglich automatisch generiert.' },
  contact: {
    title: 'Kontakt', intro: 'Fragen, Anregungen oder Kooperation? Schreib uns.',
    form: 'Nachricht senden', name: 'Dein Name', message: 'Deine Nachricht...', send: 'Senden', sent: '✓ Nachricht erfolgreich gesendet',
    email: 'E-Mail', emailDesc: 'Für allgemeine Fragen, Support oder Kooperation:',
    social: 'Social', socialDesc: 'Du findest uns auch auf:',
    products: 'Produkte', productsDesc: 'Wenn deine Frage ein bestimmtes Produkt betrifft, kontaktiere es direkt:'
  },
  legal: { updated: 'Stand:' }
};

var NOIRA_IT = {
  nav: { home: 'Home', docs: 'Docs', skills: 'Skills', tutorials: 'Tutorial', blog: 'Blog', contact: 'Contatti', about: 'Chi siamo', legal: 'Note Legali', terms: 'Termini', privacy: 'Privacy', login: 'Accedi', signup: 'Inizia' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'Un agente di codice con memoria.',
    desc: 'NoiraCoder vive nel tuo terminale: ricorda il tuo progetto tra le sessioni, alterna tra modelli gratuiti quando uno si esaurisce e mantiene le tue chiavi crittografate sulla tua macchina. Senza carta. Senza cloud obbligatoria.',
    typing: '> npm install -g noiracoder',
    term1: '> Sistemi online: memoria · rotazione free · privacy locale',
    term2: '> Tutti i sistemi disponibili',
    ctaStart: 'Inizia in 1 min',
    ctaKeys: 'Connetti 3 chiavi free'
  },
  diff: {
    title: 'Differenze', kicker: 'Perché NoiraCoder',
    sub: 'Cosa cambia nel day-by-day rispetto a un chatbot generico attaccato all\'editor.',
    c1t: '01 · Memoria a 3 livelli', c1d: 'Progetto (AGENTS.md), sessione e decisioni persistenti in .noirarc/memory/. Torna domani e l\'agente sa ancora come compili e cosa hai proibito.',
    c2t: '02 · Rotazione free intelligente', c2d: 'Una chiave OpenRouter + Groq + Zen = budget combinato. Se un modello esaurisce o perde la chiave, passa da solo a un altro provider con chiave valida.',
    c3t: '03 · Privacy locale', c3d: 'Chiavi crittografate con DPAPI sulla tua macchina, server legato a 127.0.0.1 con token, sandbox con whitelist che nega rm -rf / anche se confermi.'
  },
  install: {
    title: 'Installare', kicker: 'Installazione minima',
    sub: 'Hai bisogno di Node 20+. Niente Docker, niente account obbligatorio per iniziare.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'Connetti gratis (1 min per chiave)'
  },
  skills: { title: 'Skills', kicker: 'Skills integrate', sub: '10 specialisti, zero plugin. Documentazione completa:', all: 'Documentazione completa' },
  cmds: {
    title: 'Uso quotidiano', kicker: 'Cinque comandi e si parte',
    h1: 'Comando', h2: 'Cosa fa',
    r1: 'Apre la TUI interattiva (streaming in tempo reale).',
    r2: 'Esegue un\'attività e esce. Ideale per script.',
    r3: 'Connette una chiave (apre il browser, 1 clic).',
    r4: 'Guida delle 3 chiavi gratuite + validazione reale.',
    r5: 'API locale su 127.0.0.1 per integrare con il tuo editor.',
    more: 'Dentro la sessione:'
  },
  teasers: {
    review: 'Revisione prima di applicare: effetti, rischi, test.',
    security: 'Obbligatoria in zone sensibili: segreti, fondi, infra.',
    debug: 'Riproduce, isola, corregge con prova dell\'errore reale.',
    testing: 'Progetta casi che fallirebbero senza il fix, niente teatro.',
    refactor: 'Pulizia senza cambiamento di comportamento, test verdi.',
    perf: 'Misura prima e dopo; senza numero non c\'è miglioramento.'
  },
  contactCta: 'Contatta Noira',
  footer: {
    brand: 'Agente di codice nel terminale: memoria, rotazione free, privacy locale.',
    products: 'Ecosistema', resources: 'Risorse', community: 'Community', languages: 'Lingue',
    viewAll: 'Vedi tutti', faq: 'FAQ',
    copyright: 'Tutti i diritti riservati.'
  },
  blog: { title: 'Blog', sub: 'Note di costruzione: come funziona dentro e come sfruttarlo.', readMore: 'Leggi di più', auto: 'Nuovi post generati automaticamente ogni giorno.' },
  contact: {
    title: 'Contatti', intro: 'Domande, suggerimenti o collaborazioni? Scrivici.',
    form: 'Invia messaggio', name: 'Il tuo nome', message: 'Il tuo messaggio...', send: 'Invia', sent: '✓ Messaggio inviato con successo',
    email: 'Email', emailDesc: 'Per qualsiasi domanda generale, supporto o collaborazione:',
    social: 'Social', socialDesc: 'Puoi trovarci anche su:',
    products: 'Prodotti', productsDesc: 'Se la tua domanda riguarda un prodotto specifico, contattalo direttamente:'
  },
  legal: { updated: 'Ultimo aggiornamento:' }
};

var NOIRA_AR = {
  nav: { home: 'الرئيسية', docs: 'التوثيق', skills: 'المهارات', tutorials: 'الدروس', blog: 'المدونة', contact: 'اتصل بنا', about: 'عن نوبرا', legal: 'إشعار قانوني', terms: 'الشروط', privacy: 'الخصوصية', login: 'تسجيل الدخول', signup: 'ابدأ الآن' },
  hero: {
    title: 'NOIRACODER',
    tagline: 'وكيل برمجة مع ذاكرة.',
    desc: 'NoiraCoder يعيش في الطرفية: يتذكر مشروعك بين الجلسات، يتنقل بين النماذج المجانية عندما ينفد أحدها ويحفظ مفاتيشفعلك مشفرة على جهازك. بدون بطاقة. بدون سحابة إجبارية.',
    typing: '> npm install -g noiracoder',
    term1: '> الأنظمة متصلة: الذاكرة · التدوير المجاني · الخصوصية المحلية',
    term2: '> جميع الأنظمة متاحة',
    ctaStart: 'ابدأ في دقيقة',
    ctaKeys: 'اربط 3 مفاتيح مجانية'
  },
  diff: {
    title: 'الاختلافات', kicker: 'لماذا NoiraCoder',
    sub: 'ما الذي يتغير يومياً مقارنة ب聊天بوت عام ملتصق بالمحرر.',
    c1t: '01 · ذاكرة من 3 مستويات', c1d: 'المشروع (AGENTS.md)، الجلسة والقرارات المستمرة في .noirarc/memory/. عُد غداً والوكيل لا يزال يعرف كيف تبني وماذا منعت.',
    c2t: '02 · تدوير مجاني ذكي', c2d: 'مفتاح OpenRouter + Groq + Zen = ميزانية مجمعة. إذا نفد نموذج أو فشل أو فقد مفتاحه، ينتقل تلقائياً لمزود آخر بمفتاح صالح.',
    c3t: '03 · خصوصية محلية', c3d: 'مفاتيح مشفرة بـ DPAPI على جهازك، خادم مربوط بـ 127.0.0.1 مع رمز، صندوق رمل بقائمة بيضاء يرفض rm -rf / حتى لو أكّدت.'
  },
  install: {
    title: 'تثبيت', kicker: 'تثبيت أدنى',
    sub: 'تحتاج Node 20+. بدون Docker، بدون حساب إجباري للبدء.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'اربط مجاناً (1 دقيقة لكل مفتاح)'
  },
  skills: { title: 'المهارات', kicker: 'مهارات مدمجة', sub: '10 متخصصين، صفر إضافات. توثيق كامل:', all: 'توثيق كامل' },
  cmds: {
    title: 'الاستخدام اليومي', kicker: 'خمسة أوامر وانطلق',
    h1: 'الأمر', h2: 'ما يفعله',
    r1: 'يفتح الطرفية التفاعلية (بث مباشر).',
    r2: 'ينفذ مهمة ويخرج. مثالي للسكربتات.',
    r3: 'يربط مفتاحاً (يفتح المتصفح، نقرة واحدة).',
    r4: 'دليل المفاتيح الثلاث المجانية + تحقق حقيقي.',
    r5: 'API محلي على 127.0.0.1 للتكامل مع محررك.',
    more: 'داخل الجلسة:'
  },
  teasers: {
    review: 'مراجعة قبل التطبيق: تأثيرات، مخاطر، اختبارات.',
    security: 'إلزامية في المناطق الحساسة: أسرار، أموال، بنية تحتية.',
    debug: 'يُعيد الإنتاج، يُعزل، يُصلح مع دليل الخطأ الحقيقي.',
    testing: 'يصمم حالات ستفشل بدون الإصلاح، لا مسرحة.',
    refactor: 'تنظيف بدون تغيير السلوك، اختبارات خضراء.',
    perf: 'يقيس قبل وبعد؛ بدون رقم لا تحسين.'
  },
  contactCta: 'تواصل مع نوبرا',
  footer: {
    brand: 'وكيل برمجة في الطرفية: ذاكرة، تدوير مجاني، خصوصية محلية.',
    products: 'النظام البيئي', resources: 'الموارد', community: 'المجتمع', languages: 'اللغات',
    viewAll: 'عرض الكل', faq: 'الأسئلة الشائعة',
    copyright: 'جميع الحقوق محفوظة.'
  },
  blog: { title: 'المدونة', sub: 'ملاحظات البناء: كيف يعمل من الداخل وكيف تستفيد منه.', readMore: 'اقرأ المزيد', auto: 'منشورات جديدة تُولّد تلقائياً كل يوم.' },
  contact: {
    title: 'اتصل بنا', intro: 'أسئلة، اقتراحات أو تعاون؟ اكتب إلينا.',
    form: 'إرسال رسالة', name: 'اسمك', message: 'رسالتك...', send: 'إرسال', sent: '✓ تم إرسال الرسالة بنجاح',
    email: 'البريد الإلكتروني', emailDesc: 'لأي سؤال عام أو دعم أو تعاون:',
    social: 'التواصل الاجتماعي', socialDesc: 'يمكنك أيضاً إيجادنا على:',
    products: 'المنتجات', productsDesc: 'إذا كان سؤالك حول منتج محدد، تواصل مباشرة:'
  },
  legal: { updated: 'آخر تحديث:' }
};

var NOIRA_STRINGS = { en: NOIRA_EN, es: NOIRA_ES, pt: NOIRA_PT, fr: NOIRA_FR, de: NOIRA_DE, it: NOIRA_IT, ar: NOIRA_AR };

/* Copy-buttons: etiqueta + confirmación + toast en los 7 idiomas */
NOIRA_EN.copy = { btn: 'Copy', copied: '✓ Copied', toast: 'Copied to clipboard' };
NOIRA_ES.copy = { btn: 'Copiar', copied: '✓ Copiado', toast: 'Copiado al portapapeles' };
NOIRA_PT.copy = { btn: 'Copiar', copied: '✓ Copiado', toast: 'Copiado para a área de transferência' };
NOIRA_FR.copy = { btn: 'Copier', copied: '✓ Copié', toast: 'Copié dans le presse-papiers' };
NOIRA_DE.copy = { btn: 'Kopieren', copied: '✓ Kopiert', toast: 'In Zwischenablage kopiert' };
NOIRA_IT.copy = { btn: 'Copia', copied: '✓ Copiato', toast: 'Copiato negli appunti' };
NOIRA_AR.copy = { btn: 'نسخ', copied: '✓ تم النسخ', toast: 'تم النسخ إلى الحافظة' };

function noiraGetNested(obj, path) {
  var cur = obj;
  var keys = path.split('.');
  for (var i = 0; i < keys.length; i++) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = cur[keys[i]];
    else return path;
    if (cur === undefined) return path;
  }
  return typeof cur === 'string' ? cur : path;
}
function noiraT(key, locale) {
  var dict = NOIRA_STRINGS[locale] || NOIRA_STRINGS[NOIRA_DEFAULT];
  var v = noiraGetNested(dict, key);
  if (v !== key) return v;
  return noiraGetNested(NOIRA_STRINGS[NOIRA_DEFAULT], key);
}
function noiraGetLang() {
  try {
    var s = localStorage.getItem(NOIRA_STORAGE_KEY);
    if (s && NOIRA_LOCALES.indexOf(s) >= 0) return s;
    var b = (navigator.language || 'en').slice(0, 2);
    if (NOIRA_LOCALES.indexOf(b) >= 0) return b;
  } catch (e) {}
  return NOIRA_DEFAULT;
}
function noiraSetLang(l) {
  try { localStorage.setItem(NOIRA_STORAGE_KEY, l); } catch (e) {}
}
function noiraIsRTL(l) { return NOIRA_RTL.indexOf(l) >= 0; }

/* Aplica idioma: <html lang dir> + [data-i18n] + placeholders + switchers */
function noiraApplyLang(locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = noiraIsRTL(locale) ? 'rtl' : 'ltr';
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) els[i].textContent = noiraT(els[i].getAttribute('data-i18n'), locale);
  var phs = document.querySelectorAll('[data-i18n-ph]');
  for (var j = 0; j < phs.length; j++) phs[j].setAttribute('placeholder', noiraT(phs[j].getAttribute('data-i18n-ph'), locale));
  var cur = document.querySelectorAll('.langswitch .cur');
  for (var k = 0; k < cur.length; k++) cur[k].textContent = NOIRA_LANG_LABELS[locale] || 'EN';
  var opts = document.querySelectorAll('.langswitch .menu button, .langrow button');
  for (var m = 0; m < opts.length; m++) {
    var b = opts[m].getAttribute('data-lang');
    if (b === locale) opts[m].classList.add('active'); else opts[m].classList.remove('active');
  }
  try {
    var ev = new CustomEvent('noira-lang', { detail: locale });
    document.dispatchEvent(ev);
  } catch (e) {}
}
function noiraInitSwitcher(root) {
  var btn = root.querySelector(':scope > button');
  if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); root.classList.toggle('open'); });
  var opts = root.querySelectorAll('.menu button');
  for (var i = 0; i < opts.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-lang');
        noiraSetLang(l); noiraApplyLang(l); root.classList.remove('open');
      });
    })(opts[i]);
  }
  document.addEventListener('click', function () { root.classList.remove('open'); });
}
document.addEventListener('DOMContentLoaded', function () {
  var lang = noiraGetLang();
  noiraApplyLang(lang);
  var sw = document.querySelectorAll('.langswitch');
  for (var i = 0; i < sw.length; i++) noiraInitSwitcher(sw[i]);
  var mb = document.querySelector('[data-menu-btn]');
  var mm = document.querySelector('[data-mobile-menu]');
  if (mb && mm) mb.addEventListener('click', function () {
    var open = mm.classList.toggle('open');
    mb.textContent = open ? '[X]' : '[=]';
  });
  var rows = document.querySelectorAll('.langrow button');
  for (var j = 0; j < rows.length; j++) {
    (function (b) {
      b.addEventListener('click', function () {
        var l = b.getAttribute('data-lang');
        noiraSetLang(l); noiraApplyLang(l);
      });
    })(rows[j]);
  }
});
