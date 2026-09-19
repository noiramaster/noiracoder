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
    desc: 'It remembers your project between sessions, rotates across free models when one runs out, and starts with no signup. Your keys stay encrypted on your device.',
    typing: '> npm install -g noiracoder',
    term1: '> Systems online: memory · free rotation · no signup',
    term2: '> All systems available',
    ctaStart: 'Start in 1 min',
    ctaKeys: 'Connect 3 free keys'
  },
  diff: {
    title: 'Differences', kicker: 'Why NoiraCoder',
    sub: 'What changes day to day versus a generic chatbot glued to your editor.',
    c1t: '01 · 3-level memory', c1d: 'Project (AGENTS.md), session and persistent decisions in .noirarc/memory/. Come back tomorrow and the agent still knows how you build and what you forbade.',
    c2t: '02 · Smart free rotation', c2d: 'One OpenRouter + Groq + Zen key = combined budget. If a model runs out, fails or loses its key, it switches alone to another provider with a valid key.',
    c3t: '03 · No signup', c3d: 'Works right after install with anonymous free models. Connect your keys later only if you want more quota.'
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
    brand: 'Terminal coding agent: memory, free rotation, no signup.',
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
    desc: 'Recuerda tu proyecto entre sesiones, rota entre modelos gratuitos cuando uno se agota y empieza sin registrarte. Tus claves, cifradas en tu equipo.',
    typing: '> npm install -g noiracoder',
    term1: '> Sistemas en línea: memoria · rotación free · sin registro',
    term2: '> Todos los sistemas disponibles',
    ctaStart: 'Empezar en 1 min',
    ctaKeys: 'Conectar 3 claves free'
  },
  diff: {
    title: 'Diferencias', kicker: 'Por qué NoiraCoder',
    sub: 'Lo que cambia el día a día frente a un chatbot genérico pegado al editor.',
    c1t: '01 · Memoria de 3 niveles', c1d: 'Proyecto (AGENTS.md), sesión y decisiones persistentes en .noirarc/memory/. Vuelves mañana y el agente sigue sabiendo cómo compilas y qué prohibiste.',
    c2t: '02 · Rotación free inteligente', c2d: 'Una clave de OpenRouter + Groq + Zen = presupuesto combinado. Si un modelo se agota, falla o pierde la key, rota solo a otro proveedor con clave válida.',
    c3t: '03 · Sin registro', c3d: 'Funciona nada más instalar con modelos gratuitos anónimos. Conecta tus claves después solo si quieres más cuota.'
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
  contactCta: 'Contactar con Noira',
  footer: {
    brand: 'Agente de código en terminal: memoria, rotación free, sin registro.',
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
    desc: 'Lembra o teu projeto entre sessões, alterna entre modelos gratuitos quando um acaba e começa sem registo. As tuas chaves, cifradas no teu equipamento.',
    typing: '> npm install -g noiracoder',
    term1: '> Sistemas online: memória · rotação free · sem registo',
    term2: '> Todos os sistemas disponíveis',
    ctaStart: 'Começar em 1 min',
    ctaKeys: 'Conectar 3 chaves free'
  },
  diff: {
    title: 'Diferenças', kicker: 'Por que NoiraCoder',
    sub: 'O que muda no dia a dia frente a um chatbot genérico colado ao editor.',
    c1t: '01 · Memória de 3 níveis', c1d: 'Projeto (AGENTS.md), sessão e decisões persistentes em .noirarc/memory/. Volte amanhã e o agente ainda sabe como você compila e o que proibiu.',
    c2t: '02 · Rotação free inteligente', c2d: 'Uma chave OpenRouter + Groq + Zen = orçamento combinado. Se um modelo acaba, falha ou perde a chave, alterna sozinho para outro provedor com chave válida.',
    c3t: '03 · Sem registo', c3d: 'Funciona logo após instalar com modelos gratuitos anónimos. Liga as tuas chaves depois só se quiseres mais quota.'
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
    brand: 'Agente de código no terminal: memória, rotação free, sem registo.',
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
    desc: 'Il se souvient de ton projet entre les sessions, alterne entre des modèles gratuits quand l\u2019un s\u2019épuise et démarre sans inscription. Tes clés restent chiffrées sur ton appareil.',
    typing: '> npm install -g noiracoder',
    term1: '> Systèmes en ligne : mémoire · rotation free · sans inscription',
    term2: '> Tous les systèmes disponibles',
    ctaStart: 'Commencer en 1 min',
    ctaKeys: 'Connecter 3 clés free'
  },
  diff: {
    title: 'Différences', kicker: 'Pourquoi NoiraCoder',
    sub: 'Ce qui change au quotidien face à un chatbot générique collé à l\'éditeur.',
    c1t: '01 · Mémoire à 3 niveaux', c1d: 'Projet (AGENTS.md), session et décisions persistantes dans .noirarc/memory/. Revenez demain et l\'agent sait toujours comment vous compilez et ce que vous avez interdit.',
    c2t: '02 · Rotation free intelligente', c2d: 'Une clé OpenRouter + Groq + Zen = budget combiné. Si un modèle s\'échoue ou perd sa clé, bascule seul vers un autre fournisseur avec une clé valide.',
    c3t: '03 · Sans inscription', c3d: 'Fonctionne dès l\u2019installation avec des modèles gratuits anonymes. Connecte tes clés après, seulement si tu veux plus de quota.'
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
    brand: 'Agent de code dans le terminal : mémoire, rotation free, sans inscription.',
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
    desc: 'Erinnert sich zwischen Sitzungen an dein Projekt, wechselt zwischen kostenlosen Modellen wenn eines aufgebraucht ist und startet ohne Registrierung. Deine Schlüssel bleiben verschlüsselt auf deinem Gerät.',
    typing: '> npm install -g noiracoder',
    term1: '> Systeme online: Gedächtnis · kostenlose Rotation · ohne Registrierung',
    term2: '> Alle Systeme verfügbar',
    ctaStart: 'In 1 Min starten',
    ctaKeys: '3 kostenlose Schlüssel verbinden'
  },
  diff: {
    title: 'Unterschiede', kicker: 'Warum NoiraCoder',
    sub: 'Was sich im Alltag gegenüber einem generischen Chatbot ändert.',
    c1t: '01 · 3-Stufen-Gedächtnis', c1d: 'Projekt (AGENTS.md), Sitzung und persistente Entscheidungen in .noirarc/memory/. Komm morgen wieder und der Agent weiß immer noch, wie du baust und was du verboten hast.',
    c2t: '02 · Intelligente kostenlose Rotation', c2d: 'Ein OpenRouter + Groq + Zen Schlüssel = kombiniertes Budget. Wenn ein Modell versagt oder seinen Schlüssel verliert, wechselt es allein zu einem anderen Anbieter mit gültigem Schlüssel.',
    c3t: '03 · Ohne Registrierung', c3d: 'Läuft direkt nach der Installation mit anonymen kostenlosen Modellen. Verbinde deine Schlüssel später, nur wenn du mehr Kontingent willst.'
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
    brand: 'Code-Agent im Terminal: Gedächtnis, kostenlose Rotation, ohne Registrierung.',
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
    desc: 'Ricorda il tuo progetto tra le sessioni, alterna tra modelli gratuiti quando uno si esaurisce e parte senza registrazione. Le tue chiavi restano cifrate sul tuo dispositivo.',
    typing: '> npm install -g noiracoder',
    term1: '> Sistemi online: memoria · rotazione free · senza registrazione',
    term2: '> Tutti i sistemi disponibili',
    ctaStart: 'Inizia in 1 min',
    ctaKeys: 'Connetti 3 chiavi free'
  },
  diff: {
    title: 'Differenze', kicker: 'Perché NoiraCoder',
    sub: 'Cosa cambia giorno per giorno rispetto a un chatbot generico attaccato all\'editor.',
    c1t: '01 · Memoria a 3 livelli', c1d: 'Progetto (AGENTS.md), sessione e decisioni persistenti in .noirarc/memory/. Torna domani e l\'agente sa ancora come compili e cosa hai proibito.',
    c2t: '02 · Rotazione free intelligente', c2d: 'Una chiave OpenRouter + Groq + Zen = budget combinato. Se un modello esaurisce o perde la chiave, passa da solo a un altro provider con chiave valida.',
    c3t: '03 · Senza registrazione', c3d: 'Funziona subito dopo l\u2019installazione con modelli gratuiti anonimi. Collega le tue chiavi dopo, solo se vuoi più quota.'
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
    brand: 'Agente di codice nel terminale: memoria, rotazione free, senza registrazione.',
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
    desc: 'يتذكر مشروعك بين الجلسات، يتنقل بين النماذج المجانية عندما ينفد أحدها ويبدأ بدون تسجيل. مفاتيحك تبقى مشفرة على جهازك.',
    typing: '> npm install -g noiracoder',
    term1: '> الأنظمة متصلة: الذاكرة · التدوير المجاني · بدون تسجيل',
    term2: '> جميع الأنظمة متاحة',
    ctaStart: 'ابدأ في دقيقة',
    ctaKeys: 'اربط 3 مفاتيح مجانية'
  },
  diff: {
    title: 'الاختلافات', kicker: 'لماذا NoiraCoder',
    sub: 'ما الذي يتغير يومياً مقارنة بروبوت محادثة عام ملتصق بالمحرر.',
    c1t: '01 · ذاكرة من 3 مستويات', c1d: 'المشروع (AGENTS.md)، الجلسة والقرارات المستمرة في .noirarc/memory/. عُد غداً والوكيل لا يزال يعرف كيف تبني وماذا منعت.',
    c2t: '02 · تدوير مجاني ذكي', c2d: 'مفتاح OpenRouter + Groq + Zen = ميزانية مجمعة. إذا نفد نموذج أو فشل أو فقد مفتاحه، ينتقل تلقائياً لمزود آخر بمفتاح صالح.',
    c3t: '03 · بدون تسجيل', c3d: 'يعمل فور التثبيت مع نماذج مجانية مجهولة. اربط مفاتيحك لاحقاً فقط إذا أردت حصة أكبر.'
  },
  install: {
    title: 'تثبيت', kicker: 'تثبيت أدنى',
    sub: 'تحتاج Node 20+. بدون Docker، بدون حساب إجباري للبدء.',
    w: 'Windows (PowerShell)', m: 'macOS / Linux', s3: 'اربط مجاناً (1 دقيقة لكل مفتاح)'
  },
  skills: { title: 'المهارات', kicker: 'مهارات مدمجة', sub: '10 متخصصين، صفر إضافات. التوثيق الكامل:', all: 'التوثيق الكامل' },
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
    brand: 'وكيل برمجة في الطرفية: ذاكرة، تدوير مجاني، بدون تسجيل.',
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
NOIRA_ES.install.preWin = '# instala Node 20+ desde nodejs.org, luego:\nnpm install -g noiracoder\nnoira login';
NOIRA_ES.install.preNix = '# con Node 20+ ya instalado:\nnpm install -g noiracoder\nnoira login';
NOIRA_ES.install.preKeys = 'noira connect   # guía: Kilo anónimo + OpenRouter → Groq → Zen\nnoira "crea un hola mundo en mi proyecto"';
NOIRA_EN.install.preWin = '# install Node 20+ from nodejs.org, then:\nnpm install -g noiracoder\nnoira login';
NOIRA_EN.install.preNix = '# with Node 20+ already installed:\nnpm install -g noiracoder\nnoira login';
NOIRA_EN.install.preKeys = 'noira connect   # guide: anonymous Kilo + OpenRouter → Groq → Zen\nnoira "create a hello world in my project"';
NOIRA_PT.install.preWin = '# instala o Node 20+ em nodejs.org, depois:\nnpm install -g noiracoder\nnoira login';
NOIRA_PT.install.preNix = '# com Node 20+ já instalado:\nnpm install -g noiracoder\nnoira login';
NOIRA_PT.install.preKeys = 'noira connect   # guia: Kilo anónimo + OpenRouter → Groq → Zen\nnoira "cria um olá mundo no meu projeto"';
NOIRA_FR.install.preWin = '# installe Node 20+ depuis nodejs.org, puis :\nnpm install -g noiracoder\nnoira login';
NOIRA_FR.install.preNix = '# avec Node 20+ déjà installé :\nnpm install -g noiracoder\nnoira login';
NOIRA_FR.install.preKeys = 'noira connect   # guide : Kilo anonyme + OpenRouter → Groq → Zen\nnoira "crée un hello world dans mon projet"';
NOIRA_DE.install.preWin = '# installiere Node 20+ von nodejs.org, dann:\nnpm install -g noiracoder\nnoira login';
NOIRA_DE.install.preNix = '# mit bereits installiertem Node 20+:\nnpm install -g noiracoder\nnoira login';
NOIRA_DE.install.preKeys = 'noira connect   # Anleitung: anonymes Kilo + OpenRouter → Groq → Zen\nnoira "erstelle ein Hallo-Welt in meinem Projekt"';
NOIRA_IT.install.preWin = '# installa Node 20+ da nodejs.org, poi:\nnpm install -g noiracoder\nnoira login';
NOIRA_IT.install.preNix = '# con Node 20+ già installato:\nnpm install -g noiracoder\nnoira login';
NOIRA_IT.install.preKeys = 'noira connect   # guida: Kilo anonimo + OpenRouter → Groq → Zen\nnoira "crea un hello world nel mio progetto"';
NOIRA_AR.install.preWin = '# ثبّت Node 20+ من nodejs.org، ثم:\nnpm install -g noiracoder\nnoira login';
NOIRA_AR.install.preNix = '# مع تثبيت Node 20+ مسبقاً:\nnpm install -g noiracoder\nnoira login';
NOIRA_AR.install.preKeys = 'noira connect   # دليل: Kilo مجهول + OpenRouter → Groq → Zen\nnoira "أنشئ hello world في مشروعي"';

/* Sobre (cuerpos traducidos; p4 con enlace) */
NOIRA_ES.sobre = {
  p1: 'NoiraCoder es el agente de código en terminal del ecosistema Noira. No es una persona ni un chatbot genérico: es una herramienta que lee tu proyecto, ejecuta comandos y edita archivos bajo tus reglas — y recuerda lo que decide entre sesiones.',
  h1: 'Qué hacemos',
  p2: 'Tus claves se cifran en tu equipo y el servidor local solo escucha en 127.0.0.1 con token. La IA rota entre modelos gratuitos (Kilo, OpenRouter, Groq, Zen) para que casi nunca te quedes sin cuota. Tus prompts viajan al proveedor que elijas para generar la respuesta.',
  h2: 'Nuestra filosofía',
  p3: 'Tecnología honesta: explicamos lo que hace el software. Calidad en los detalles pequeños. Accesibilidad: empezar es gratis, sin registro.',
  h3: 'El ecosistema',
  p4_html: 'NoiraCoder es un producto del ecosistema <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a> (la marca madre). Cada producto del ecosistema es independiente, con su propia web y condiciones.'
};
NOIRA_EN.sobre = {
  p1: 'NoiraCoder is the terminal coding agent of the Noira ecosystem. Not a person or a generic chatbot: a tool that reads your project, runs commands and edits files under your rules — and remembers what it decides between sessions.',
  h1: 'What we do',
  p2: 'Your keys are encrypted on your device and the local server only listens on 127.0.0.1 with a token. The AI rotates across free models (Kilo, OpenRouter, Groq, Zen) so you almost never run out of quota. Your prompts travel to the provider you choose to generate the answer.',
  h2: 'Our philosophy',
  p3: 'Honest technology: we explain what the software does. Quality in the small details. Accessibility: starting is free, no signup.',
  h3: 'The ecosystem',
  p4_html: 'NoiraCoder is a product of the <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a> ecosystem (the mother brand). Each ecosystem product is independent, with its own site and terms.'
};
NOIRA_PT.sobre = {
  p1: 'NoiraCoder é o agente de código no terminal do ecossistema Noira. Não é uma pessoa nem um chatbot genérico: é uma ferramenta que lê o teu projeto, executa comandos e edita ficheiros sob as tuas regras — e lembra o que decide entre sessões.',
  h1: 'O que fazemos',
  p2: 'As tuas chaves são cifradas no teu equipamento e o servidor local só escuta em 127.0.0.1 com token. A IA alterna entre modelos gratuitos (Kilo, OpenRouter, Groq, Zen) para quase nunca ficares sem quota. Os teus prompts viajam até ao fornecedor que escolheres para gerar a resposta.',
  h2: 'A nossa filosofia',
  p3: 'Tecnologia honesta: explicamos o que o software faz. Qualidade nos pequenos detalhes. Acessibilidade: começar é grátis, sem registo.',
  h3: 'O ecossistema',
  p4_html: 'NoiraCoder é um produto do ecossistema <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a> (a marca mãe). Cada produto do ecossistema é independente, com o seu próprio site e condições.'
};
NOIRA_FR.sobre = {
  p1: 'NoiraCoder est l\u2019agent de code en terminal de l\u2019écosystème Noira. Ni une personne ni un chatbot générique : un outil qui lit ton projet, exécute des commandes et édite des fichiers selon tes règles — et se souvient de ce qu\u2019il décide entre les sessions.',
  h1: 'Ce que nous faisons',
  p2: 'Tes clés sont chiffrées sur ton appareil et le serveur local n\u2019écoute que sur 127.0.0.1 avec un token. L\u2019IA alterne entre des modèles gratuits (Kilo, OpenRouter, Groq, Zen) pour que tu quota ne s\u2019épuise presque jamais. Tes prompts voyagent chez le fournisseur que tu choisis pour générer la réponse.',
  h2: 'Notre philosophie',
  p3: 'Technologie honnête : nous expliquons ce que fait le logiciel. Qualité dans les petits détails. Accessibilité : commencer est gratuit, sans inscription.',
  h3: 'L\u2019écosystème',
  p4_html: 'NoiraCoder est un produit de l\u2019écosystème <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a> (la marque mère). Chaque produit de l\u2019écosystème est indépendant, avec son propre site et ses conditions.'
};
NOIRA_DE.sobre = {
  p1: 'NoiraCoder ist der Terminal-Code-Agent des Noira-Ökosystems. Keine Person und kein generischer Chatbot: ein Werkzeug, das dein Projekt liest, Befehle ausführt und Dateien nach deinen Regeln bearbeitet — und sich zwischen Sitzungen merkt, was es entschieden hat.',
  h1: 'Was wir tun',
  p2: 'Deine Schlüssel sind auf deinem Gerät verschlüsselt und der lokale Server hört nur auf 127.0.0.1 mit Token. Die KI rotiert zwischen kostenlosen Modellen (Kilo, OpenRouter, Groq, Zen), damit dir fast nie das Kontingent ausgeht. Deine Prompts gehen an den Anbieter deiner Wahl, um die Antwort zu erzeugen.',
  h2: 'Unsere Philosophie',
  p3: 'Ehrliche Technologie: Wir erklären, was die Software tut. Qualität im Detail. Barrierefreiheit: Der Einstieg ist gratis, ohne Registrierung.',
  h3: 'Das Ökosystem',
  p4_html: 'NoiraCoder ist ein Produkt des <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a>-Ökosystems (der Muttermarke). Jedes Produkt des Ökosystems ist unabhängig, mit eigener Website und Bedingungen.'
};
NOIRA_IT.sobre = {
  p1: 'NoiraCoder è l\u2019agente di codice nel terminale dell\u2019ecosistema Noira. Non una persona né un chatbot generico: uno strumento che legge il tuo progetto, esegue comandi e modifica file secondo le tue regole — e ricorda cosa decide tra le sessioni.',
  h1: 'Cosa facciamo',
  p2: 'Le tue chiavi sono cifrate sul tuo dispositivo e il server locale ascolta solo su 127.0.0.1 con token. L\u2019IA alterna tra modelli gratuiti (Kilo, OpenRouter, Groq, Zen) così quasi non resti mai senza quota. I tuoi prompt viaggiano al provider che scegli per generare la risposta.',
  h2: 'La nostra filosofia',
  p3: 'Tecnologia onesta: spieghiamo cosa fa il software. Qualità nei piccoli dettagli. Accessibilità: iniziare è gratis, senza registrazione.',
  h3: 'L\u2019ecosistema',
  p4_html: 'NoiraCoder è un prodotto dell\u2019ecosistema <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a> (il marchio madre). Ogni prodotto dell\u2019ecosistema è indipendente, con il proprio sito e condizioni.'
};
NOIRA_AR.sobre = {
  p1: 'NoiraCoder هو وكيل البرمجة في الطرفية ضمن منظومة Noira. ليس شخصاً ولا روبوت محادثة عام: أداة تقرأ مشروعك وتنفذ الأوامر وتحرر الملفات وفق قواعدك — وتتذكر ما تقرره بين الجلسات.',
  h1: 'ماذا نفعل',
  p2: 'مفاتيحك مشفرة على جهازك والخادم المحلي يستمع فقط على 127.0.0.1 مع رمز. يتنقل الذكاء الاصطناعي بين نماذج مجانية (Kilo، OpenRouter، Groq، Zen) حتى لا تنفد حصتك تقريباً أبداً. تنتقل طلباتك إلى المزود الذي تختاره لتوليد الإجابة.',
  h2: 'فلسفتنا',
  p3: 'تقنية صادقة: نشرح ما يفعله البرنامج. جودة في التفاصيل الصغيرة. إمكانية الوصول: البدء مجاني، بدون تسجيل.',
  h3: 'المنظومة',
  p4_html: 'NoiraCoder منتج من منظومة <a class="link-accent" href="https://noiramaster.pages.dev/" target="_blank" rel="noopener">Noiramaster</a> (العلامة الأم). كل منتج في المنظومة مستقل، بموقعه وشروطه الخاصة.'
};

/* Términos (cuerpos traducidos) */
NOIRA_ES.term = {
  h1: 'Objeto',
  p1: 'Estos términos regulan el uso de la web de NoiraCoder y del agente de código que se instala en tu equipo. Al usarlos aceptas estas condiciones.',
  h2: 'Uso aceptable',
  p2: 'Usa el agente en proyectos propios o con permiso. No lo uses para dañar sistemas ajenos, extraer secretos de terceros ni generar código malicioso. Las acciones destructivas siempre requieren tu confirmación explícita.',
  h3: 'Claves y cuota',
  p3: 'Tus claves de proveedor (Kilo, OpenRouter, Groq, Zen) se guardan cifradas en tu equipo y solo viajan al proveedor correspondiente para generar respuestas. El consumo de cuota gratuita depende de cada proveedor.',
  h4: 'Propiedad intelectual',
  p4: 'El código que el agente genera o modifica en tus proyectos te pertenece. La marca NoiraCoder y esta web pertenecen al ecosistema Noira.',
  h5: 'Limitación de responsabilidad',
  p5: 'El agente propone cambios; tú decides publicarlos. Revisa siempre antes de desplegar. No garantizamos que el código generado esté libre de errores.',
  h6: 'Modificaciones y contacto',
  p6_html: 'Podemos actualizar estos términos; los cambios relevantes se anunciarán con antelación. Dudas: <a class="link-accent" href="/contacto.html">contacto →</a>'
};
NOIRA_EN.term = {
  h1: 'Purpose',
  p1: 'These terms govern the use of the NoiraCoder website and the coding agent installed on your device. By using them you accept these conditions.',
  h2: 'Acceptable use',
  p2: 'Use the agent on your own projects or with permission. Do not use it to harm other systems, extract third-party secrets or generate malicious code. Destructive actions always require your explicit confirmation.',
  h3: 'Keys and quota',
  p3: 'Your provider keys (Kilo, OpenRouter, Groq, Zen) are stored encrypted on your device and only travel to the matching provider to generate answers. Free quota usage depends on each provider.',
  h4: 'Intellectual property',
  p4: 'Code the agent generates or modifies in your projects belongs to you. The NoiraCoder brand and this site belong to the Noira ecosystem.',
  h5: 'Limitation of liability',
  p5: 'The agent proposes changes; you decide to publish them. Always review before deploying. We do not guarantee generated code is error-free.',
  h6: 'Changes and contact',
  p6_html: 'We may update these terms; relevant changes will be announced in advance. Questions: <a class="link-accent" href="/contacto.html">contact →</a>'
};
NOIRA_PT.term = {
  h1: 'Objeto',
  p1: 'Estes termos regulam o uso do site NoiraCoder e do agente de código instalado no teu equipamento. Ao usá-los aceitas estas condições.',
  h2: 'Uso aceitável',
  p2: 'Usa o agente em projetos próprios ou com permissão. Não o uses para danificar sistemas alheios, extrair segredos de terceiros nem gerar código malicioso. Ações destrutivas exigem sempre a tua confirmação explícita.',
  h3: 'Chaves e quota',
  p3: 'As tuas chaves de fornecedor (Kilo, OpenRouter, Groq, Zen) ficam cifradas no teu equipamento e só viajam até ao fornecedor correspondente para gerar respostas. O consumo de quota gratuita depende de cada fornecedor.',
  h4: 'Propriedade intelectual',
  p4: 'O código que o agente gera ou modifica nos teus projetos pertence-te. A marca NoiraCoder e este site pertencem ao ecossistema Noira.',
  h5: 'Limitação de responsabilidade',
  p5: 'O agente propõe alterações; tu decides publicá-las. Revê sempre antes de implantar. Não garantimos que o código gerado esteja livre de erros.',
  h6: 'Alterações e contacto',
  p6_html: 'Podemos atualizar estes termos; alterações relevantes serão anunciadas com antecedência. Dúvidas: <a class="link-accent" href="/contacto.html">contacto →</a>'
};
NOIRA_FR.term = {
  h1: 'Objet',
  p1: 'Ces conditions régissent l\u2019utilisation du site NoiraCoder et de l\u2019agent de code installé sur ton appareil. En les utilisant tu acceptes ces conditions.',
  h2: 'Usage acceptable',
  p2: 'Utilise l\u2019agent sur tes propres projets ou avec permission. Ne l\u2019utilise pas pour endommager des systèmes tiers, extraire des secrets ou générer du code malveillant. Les actions destructrices exigent toujours ta confirmation explicite.',
  h3: 'Clés et quota',
  p3: 'Tes clés de fournisseur (Kilo, OpenRouter, Groq, Zen) sont stockées chiffrées sur ton appareil et ne voyagent que vers le fournisseur concerné pour générer des réponses. La consommation du quota gratuit dépend de chaque fournisseur.',
  h4: 'Propriété intellectuelle',
  p4: 'Le code que l\u2019agent génère ou modifie dans tes projets t\u2019appartient. La marque NoiraCoder et ce site appartiennent à l\u2019écosystème Noira.',
  h5: 'Limitation de responsabilité',
  p5: 'L\u2019agent propose des changements ; c\u2019est toi qui décides de les publier. Vérifie toujours avant de déployer. Nous ne garantissons pas que le code généré soit sans erreur.',
  h6: 'Modifications et contact',
  p6_html: 'Nous pouvons mettre à jour ces conditions ; les changements importants seront annoncés à l\u2019avance. Questions : <a class="link-accent" href="/contacto.html">contact →</a>'
};
NOIRA_DE.term = {
  h1: 'Gegenstand',
  p1: 'Diese Bedingungen regeln die Nutzung der NoiraCoder-Website und des Code-Agenten auf deinem Gerät. Mit der Nutzung akzeptierst du diese Bedingungen.',
  h2: 'Akzeptable Nutzung',
  p2: 'Nutze den Agenten für eigene Projekte oder mit Erlaubnis. Nutze ihn nicht, um fremde Systeme zu schädigen, fremde Geheimnisse zu extrahieren oder Schadcode zu erzeugen. Destruktive Aktionen erfordern immer deine ausdrückliche Bestätigung.',
  h3: 'Schlüssel und Kontingent',
  p3: 'Deine Anbieter-Schlüssel (Kilo, OpenRouter, Groq, Zen) liegen verschlüsselt auf deinem Gerät und gehen nur an den jeweiligen Anbieter, um Antworten zu erzeugen. Der Verbrauch des Frei-Kontingents hängt vom Anbieter ab.',
  h4: 'Geistiges Eigentum',
  p4: 'Code, den der Agent in deinen Projekten erzeugt oder ändert, gehört dir. Die Marke NoiraCoder und diese Website gehören zum Noira-Ökosystem.',
  h5: 'Haftungsbeschränkung',
  p5: 'Der Agent schlägt Änderungen vor; du entscheidest über die Veröffentlichung. Prüfe immer vor dem Deploy. Wir garantieren nicht, dass generierter Code fehlerfrei ist.',
  h6: 'Änderungen und Kontakt',
  p6_html: 'Wir können diese Bedingungen aktualisieren; relevante Änderungen werden vorab angekündigt. Fragen: <a class="link-accent" href="/contacto.html">Kontakt →</a>'
};
NOIRA_IT.term = {
  h1: 'Oggetto',
  p1: 'Questi termini regolano l\u2019uso del sito NoiraCoder e dell\u2019agente di codice installato sul tuo dispositivo. Usandoli accetti queste condizioni.',
  h2: 'Uso accettabile',
  p2: 'Usa l\u2019agente nei tuoi progetti o con permesso. Non usarlo per danneggiare sistemi altrui, estrarre segreti di terzi o generare codice dannoso. Le azioni distruttive richiedono sempre la tua conferma esplicita.',
  h3: 'Chiavi e quota',
  p3: 'Le tue chiavi dei provider (Kilo, OpenRouter, Groq, Zen) sono conservate cifrate sul tuo dispositivo e viaggiano solo verso il provider corrispondente per generare risposte. Il consumo della quota gratuita dipende da ogni provider.',
  h4: 'Proprietà intellettuale',
  p4: 'Il codice che l\u2019agente genera o modifica nei tuoi progetti ti appartiene. Il marchio NoiraCoder e questo sito appartengono all\u2019ecosistema Noira.',
  h5: 'Limitazione di responsabilità',
  p5: 'L\u2019agente propone modifiche; decidi tu se pubblicarle. Verifica sempre prima del deploy. Non garantiamo che il codice generato sia privo di errori.',
  h6: 'Modifiche e contatti',
  p6_html: 'Possiamo aggiornare questi termini; le modifiche rilevanti saranno annunciate in anticipo. Dubbi: <a class="link-accent" href="/contacto.html">contatti →</a>'
};
NOIRA_AR.term = {
  h1: 'الموضوع',
  p1: 'تنظم هذه الشروط استخدام موقع NoiraCoder ووكيل البرمجة المثبت على جهازك. باستخدامك لهما فأنت تقبل هذه الشروط.',
  h2: 'الاستخدام المقبول',
  p2: 'استخدم الوكيل في مشاريعك الخاصة أو بإذن. لا تستخدمه للإضرار بأنظمة الآخرين أو استخراج أسرار الغير أو توليد شيفرة خبيثة. الإجراءات المدمرة تتطلب دائماً تأكيدك الصريح.',
  h3: 'المفاتيح والحصة',
  p3: 'مفاتيح المزودين (Kilo، OpenRouter، Groq، Zen) محفوظة مشفرة على جهازك ولا تنتقل إلا إلى المزود المعني لتوليد الإجابات. استهلاك الحصة المجانية يعتمد على كل مزود.',
  h4: 'الملكية الفكرية',
  p4: 'الشيفرة التي يولدها الوكيل أو يعدلها في مشاريعك ملك لك. علامة NoiraCoder وهذا الموقع ملك لمنظومة Noira.',
  h5: 'تحديد المسؤولية',
  p5: 'يقترح الوكيل التغييرات؛ وأنت تقرر نشرها. راجع دائماً قبل النشر. لا نضمن أن الشيفرة المولدة خالية من الأخطاء.',
  h6: 'التعديلات والتواصل',
  p6_html: 'قد نحدّث هذه الشروط؛ سيُعلن عن التغييرات المهمة مسبقاً. أسئلة: <a class="link-accent" href="/contacto.html">اتصل بنا →</a>'
};

/* Privacidad (cuerpos traducidos) */
NOIRA_ES.priv = {
  h1: 'Responsable',
  p1: 'Ecosistema Noira · noiramaster@gmail.com. Esta web es estática: no tiene cuentas, no guarda sesiones y no vende datos. Punto.',
  h2: 'Qué recoge esta web',
  p2_html: 'Casi nada: tu preferencia de idioma (<code class="inline">localStorage</code>, solo en tu navegador) y, si usas el formulario de contacto, los datos que escribas (nombre, email, mensaje), enviados al email del ecosistema.',
  h3: 'Qué hace el agente en tu equipo',
  p3_html: 'NoiraCoder guarda tus claves cifradas en tu equipo, tu memoria de proyecto en <code class="inline">.noirarc/</code> y tus prompts solo viajan al proveedor de modelos que elijas (Kilo, OpenRouter, Groq o Zen) para generar la respuesta. No enviamos tu código a ningún otro sitio.',
  h4: 'Base jurídica y conservación',
  p4_html: 'Tratamos los datos de contacto por interés legítimo (responderte) y los conservamos solo lo necesario. Los datos en tu equipo los controlas tú: <code class="inline">noira /logout</code> borra las claves.',
  h5: 'Tus derechos',
  p5: 'Acceso, rectificación, supresión, oposición, limitación y portabilidad: escribe a noiramaster@gmail.com y lo resolvemos.',
  h6: 'Cookies',
  p6_html: 'Esta web no usa cookies de seguimiento. Solo <code class="inline">localStorage</code> para el idioma. Sin banners porque no hay nada que aceptar.'
};
NOIRA_EN.priv = {
  h1: 'Controller',
  p1: 'Noira ecosystem · noiramaster@gmail.com. This site is static: no accounts, no stored sessions, no data selling. Period.',
  h2: 'What this site collects',
  p2_html: 'Almost nothing: your language preference (<code class="inline">localStorage</code>, only in your browser) and, if you use the contact form, what you type (name, email, message), sent to the ecosystem email.',
  h3: 'What the agent does on your device',
  p3_html: 'NoiraCoder stores your encrypted keys on your device, your project memory in <code class="inline">.noirarc/</code>, and your prompts only travel to the model provider you choose (Kilo, OpenRouter, Groq or Zen) to generate the answer. We do not send your code anywhere else.',
  h4: 'Legal basis and retention',
  p4_html: 'We process contact data under legitimate interest (answering you) and keep it only as long as needed. Data on your device is yours: <code class="inline">noira /logout</code> wipes the keys.',
  h5: 'Your rights',
  p5: 'Access, rectification, erasure, objection, restriction and portability: write to noiramaster@gmail.com and we will sort it out.',
  h6: 'Cookies',
  p6_html: 'This site uses no tracking cookies. Only <code class="inline">localStorage</code> for the language. No banners because there is nothing to accept.'
};
NOIRA_PT.priv = {
  h1: 'Responsável',
  p1: 'Ecossistema Noira · noiramaster@gmail.com. Este site é estático: sem contas, sem sessões guardadas, sem venda de dados. Ponto.',
  h2: 'O que este site recolhe',
  p2_html: 'Quase nada: a tua preferência de idioma (<code class="inline">localStorage</code>, só no teu navegador) e, se usares o formulário de contacto, o que escreveres (nome, email, mensagem), enviado para o email do ecossistema.',
  h3: 'O que o agente faz no teu equipamento',
  p3_html: 'NoiraCoder guarda as tuas chaves cifradas no teu equipamento, a tua memória de projeto em <code class="inline">.noirarc/</code>, e os teus prompts só viajam até ao fornecedor de modelos que escolheres (Kilo, OpenRouter, Groq ou Zen) para gerar a resposta. Não enviamos o teu código para mais lado nenhum.',
  h4: 'Base jurídica e conservação',
  p4_html: 'Tratamos os dados de contacto por interesse legítimo (responder-te) e conservamo-los só o necessário. Os dados no teu equipamento controlas tu: <code class="inline">noira /logout</code> apaga as chaves.',
  h5: 'Os teus direitos',
  p5: 'Acesso, retificação, apagamento, oposição, limitação e portabilidade: escreve para noiramaster@gmail.com e resolvemos.',
  h6: 'Cookies',
  p6_html: 'Este site não usa cookies de seguimento. Só <code class="inline">localStorage</code> para o idioma. Sem banners porque não há nada a aceitar.'
};
NOIRA_FR.priv = {
  h1: 'Responsable',
  p1: 'Écosystème Noira · noiramaster@gmail.com. Ce site est statique : pas de comptes, pas de sessions stockées, pas de vente de données. Point.',
  h2: 'Ce que ce site collecte',
  p2_html: 'Presque rien : ta préférence de langue (<code class="inline">localStorage</code>, seulement dans ton navigateur) et, si tu utilises le formulaire de contact, ce que tu écris (nom, email, message), envoyé à l\u2019email de l\u2019écosystème.',
  h3: 'Ce que l\u2019agent fait sur ton appareil',
  p3_html: 'NoiraCoder stocke tes clés chiffrées sur ton appareil, ta mémoire de projet dans <code class="inline">.noirarc/</code>, et tes prompts ne voyagent que vers le fournisseur de modèles que tu choisis (Kilo, OpenRouter, Groq ou Zen) pour générer la réponse. Nous n\u2019envoyons ton code nulle part ailleurs.',
  h4: 'Base juridique et conservation',
  p4_html: 'Nous traitons les données de contact par intérêt légitime (te répondre) et les gardons seulement le temps nécessaire. Les données sur ton appareil t\u2019appartiennent : <code class="inline">noira /logout</code> efface les clés.',
  h5: 'Tes droits',
  p5: 'Accès, rectification, suppression, opposition, limitation et portabilité : écris à noiramaster@gmail.com et on règle ça.',
  h6: 'Cookies',
  p6_html: 'Ce site n\u2019utilise pas de cookies de suivi. Seulement <code class="inline">localStorage</code> pour la langue. Pas de bannières car il n\u2019y a rien à accepter.'
};
NOIRA_DE.priv = {
  h1: 'Verantwortlicher',
  p1: 'Noira-Ökosystem · noiramaster@gmail.com. Diese Website ist statisch: keine Konten, keine gespeicherten Sitzungen, kein Datenverkauf. Punkt.',
  h2: 'Was diese Website erhebt',
  p2_html: 'Fast nichts: deine Sprachpräferenz (<code class="inline">localStorage</code>, nur in deinem Browser) und, wenn du das Kontaktformular nutzt, was du schreibst (Name, E-Mail, Nachricht), gesendet an die E-Mail des Ökosystems.',
  h3: 'Was der Agent auf deinem Gerät tut',
  p3_html: 'NoiraCoder speichert deine verschlüsselten Schlüssel auf deinem Gerät, dein Projektgedächtnis in <code class="inline">.noirarc/</code>, und deine Prompts gehen nur an den Modellanbieter deiner Wahl (Kilo, OpenRouter, Groq oder Zen), um die Antwort zu erzeugen. Wir senden deinen Code nirgendwo sonst hin.',
  h4: 'Rechtsgrundlage und Speicherung',
  p4_html: 'Wir verarbeiten Kontaktdaten aus berechtigtem Interesse (dir zu antworten) und nur so lange wie nötig. Daten auf deinem Gerät gehören dir: <code class="inline">noira /logout</code> löscht die Schlüssel.',
  h5: 'Deine Rechte',
  p5: 'Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung und Übertragbarkeit: schreib an noiramaster@gmail.com und wir klären das.',
  h6: 'Cookies',
  p6_html: 'Diese Website nutzt keine Tracking-Cookies. Nur <code class="inline">localStorage</code> für die Sprache. Keine Banner, denn es gibt nichts zu akzeptieren.'
};
NOIRA_IT.priv = {
  h1: 'Titolare',
  p1: 'Ecosistema Noira · noiramaster@gmail.com. Questo sito è statico: niente account, niente sessioni salvate, niente vendita di dati. Punto.',
  h2: 'Cosa raccoglie questo sito',
  p2_html: 'Quasi niente: la tua preferenza di lingua (<code class="inline">localStorage</code>, solo nel tuo browser) e, se usi il modulo di contatto, ciò che scrivi (nome, email, messaggio), inviato all\u2019email dell\u2019ecosistema.',
  h3: 'Cosa fa l\u2019agente sul tuo dispositivo',
  p3_html: 'NoiraCoder conserva le tue chiavi cifrate sul tuo dispositivo, la tua memoria di progetto in <code class="inline">.noirarc/</code>, e i tuoi prompt viaggiano solo verso il provider di modelli che scegli (Kilo, OpenRouter, Groq o Zen) per generare la risposta. Non inviamo il tuo codice da nessun\u2019altra parte.',
  h4: 'Base giuridica e conservazione',
  p4_html: 'Trattiamo i dati di contatto per interesse legittimo (risponderti) e li conserviamo solo il necessario. I dati sul tuo dispositivo sono tuoi: <code class="inline">noira /logout</code> elimina le chiavi.',
  h5: 'I tuoi diritti',
  p5: 'Accesso, rettifica, cancellazione, opposizione, limitazione e portabilità: scrivi a noiramaster@gmail.com e risolviamo.',
  h6: 'Cookie',
  p6_html: 'Questo sito non usa cookie di tracciamento. Solo <code class="inline">localStorage</code> per la lingua. Niente banner perché non c\u2019è nulla da accettare.'
};
NOIRA_AR.priv = {
  h1: 'المسؤول',
  p1: 'منظومة Noira · noiramaster@gmail.com. هذا الموقع ثابت: لا حسابات، لا جلسات محفوظة، لا بيع للبيانات. نقطة.',
  h2: 'ما يجمعه هذا الموقع',
  p2_html: 'لا شيء تقريباً: تفضيل لغتك (<code class="inline">localStorage</code>، في متصفحك فقط)، وإذا استخدمت نموذج التواصل، ما تكتبه (الاسم، البريد، الرسالة) المُرسل إلى بريد المنظومة.',
  h3: 'ما يفعله الوكيل على جهازك',
  p3_html: 'يحفظ NoiraCoder مفاتيحك المشفرة على جهازك، وذاكرة مشروعك في <code class="inline">.noirarc/</code>، ولا تنتقل طلباتك إلا إلى مزود النماذج الذي تختاره (Kilo، OpenRouter، Groq أو Zen) لتوليد الإجابة. لا نرسل شيفرتك إلى أي مكان آخر.',
  h4: 'الأساس القانوني والاحتفاظ',
  p4_html: 'نعالج بيانات التواصل للمصلحة المشروعة (الرد عليك) ونحتفظ بها للضرورة فقط. البيانات على جهازك ملكك: <code class="inline">noira /logout</code> يمسح المفاتيح.',
  h5: 'حقوقك',
  p5: 'الوصول والتصحيح والمسح والاعتراض والتقييد وقابلية النقل: اكتب إلى noiramaster@gmail.com وسنحل الأمر.',
  h6: 'ملفات الارتباط',
  p6_html: 'هذا الموقع لا يستخدم كوكيز تتبع. فقط <code class="inline">localStorage</code> للغة. لا لافتات لأنه لا شيء لقبوله.'
};

/* Legal (cuerpos traducidos) */
NOIRA_ES.legal2 = {
  h1: 'Titularidad',
  p1: 'NoiraCoder es un producto del ecosistema Noira. Contacto: noiramaster@gmail.com. Cada producto del ecosistema es independiente, con su propia web y condiciones.',
  h2: 'Objeto',
  p2_html: 'Esta web presenta NoiraCoder, un agente de código en terminal. El software se instala con <code class="inline">npm install -g noiracoder</code> y se usa bajo la responsabilidad del usuario en sus propios proyectos.',
  h3: 'Propiedad intelectual',
  p3: 'Los textos, el diseño y el código de esta web pertenecen a sus titulares. El agente NoiraCoder genera o modifica código en el equipo del usuario: ese código resultante pertenece al usuario.',
  h4: 'Enlaces externos',
  p4: 'Esta web enlaza a webs del ecosistema y a proveedores de modelos (Kilo, OpenRouter, Groq, Zen). No controlamos sus contenidos ni sus condiciones.',
  h5: 'Responsabilidad',
  p5: 'El agente ejecuta acciones en tu equipo (editar archivos, correr comandos) siempre con confirmación en pasos sensibles. Revisa cada cambio antes de publicarlo. No nos hacemos responsables de código publicado sin revisión.',
  h6: 'Ley aplicable',
  p6_html: 'Para cualquier controversia, escríbenos primero a noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">Contacto →</a>'
};
NOIRA_EN.legal2 = {
  h1: 'Ownership',
  p1: 'NoiraCoder is a product of the Noira ecosystem. Contact: noiramaster@gmail.com. Each ecosystem product is independent, with its own site and terms.',
  h2: 'Purpose',
  p2_html: 'This site presents NoiraCoder, a terminal coding agent. The software installs with <code class="inline">npm install -g noiracoder</code> and is used under the user\u2019s responsibility on their own projects.',
  h3: 'Intellectual property',
  p3: 'The texts, design and code of this site belong to their owners. The NoiraCoder agent generates or modifies code on the user\u2019s device: that resulting code belongs to the user.',
  h4: 'External links',
  p4: 'This site links to ecosystem sites and model providers (Kilo, OpenRouter, Groq, Zen). We do not control their content or terms.',
  h5: 'Liability',
  p5: 'The agent performs actions on your device (editing files, running commands), always with confirmation on sensitive steps. Review every change before publishing. We are not liable for code published without review.',
  h6: 'Applicable law',
  p6_html: 'For any dispute, write to us first at noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">Contact →</a>'
};
NOIRA_PT.legal2 = {
  h1: 'Titularidade',
  p1: 'NoiraCoder é um produto do ecossistema Noira. Contacto: noiramaster@gmail.com. Cada produto do ecossistema é independente, com o seu próprio site e condições.',
  h2: 'Objeto',
  p2_html: 'Este site apresenta NoiraCoder, um agente de código no terminal. O software instala-se com <code class="inline">npm install -g noiracoder</code> e usa-se sob a responsabilidade do utilizador nos seus próprios projetos.',
  h3: 'Propriedade intelectual',
  p3: 'Os textos, o design e o código deste site pertencem aos seus titulares. O agente NoiraCoder gera ou modifica código no equipamento do utilizador: esse código resultante pertence ao utilizador.',
  h4: 'Ligações externas',
  p4: 'Este site liga para sites do ecossistema e fornecedores de modelos (Kilo, OpenRouter, Groq, Zen). Não controlamos os seus conteúdos nem condições.',
  h5: 'Responsabilidade',
  p5: 'O agente executa ações no teu equipamento (editar ficheiros, correr comandos), sempre com confirmação em passos sensíveis. Revê cada alteração antes de publicar. Não nos responsabilizamos por código publicado sem revisão.',
  h6: 'Lei aplicável',
  p6_html: 'Para qualquer litígio, escreve-nos primeiro para noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">Contacto →</a>'
};
NOIRA_FR.legal2 = {
  h1: 'Titularité',
  p1: 'NoiraCoder est un produit de l\u2019écosystème Noira. Contact : noiramaster@gmail.com. Chaque produit de l\u2019écosystème est indépendant, avec son propre site et ses conditions.',
  h2: 'Objet',
  p2_html: 'Ce site présente NoiraCoder, un agent de code en terminal. Le logiciel s\u2019installe avec <code class="inline">npm install -g noiracoder</code> et s\u2019utilise sous ta responsabilité sur tes propres projets.',
  h3: 'Propriété intellectuelle',
  p3: 'Les textes, le design et le code de ce site appartiennent à leurs titulaires. L\u2019agent NoiraCoder génère ou modifie du code sur ton appareil : ce code résultant t\u2019appartient.',
  h4: 'Liens externes',
  p4: 'Ce site lie vers des sites de l\u2019écosystème et des fournisseurs de modèles (Kilo, OpenRouter, Groq, Zen). Nous ne contrôlons ni leurs contenus ni leurs conditions.',
  h5: 'Responsabilité',
  p5: 'L\u2019agent exécute des actions sur ton appareil (éditer des fichiers, lancer des commandes), toujours avec confirmation aux étapes sensibles. Vérifie chaque changement avant de publier. Nous ne sommes pas responsables du code publié sans relecture.',
  h6: 'Droit applicable',
  p6_html: 'Pour tout litige, écris-nous d\u2019abord à noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">Contact →</a>'
};
NOIRA_DE.legal2 = {
  h1: 'Inhaberschaft',
  p1: 'NoiraCoder ist ein Produkt des Noira-Ökosystems. Kontakt: noiramaster@gmail.com. Jedes Produkt des Ökosystems ist unabhängig, mit eigener Website und Bedingungen.',
  h2: 'Gegenstand',
  p2_html: 'Diese Website präsentiert NoiraCoder, einen Terminal-Code-Agenten. Die Software installiert sich mit <code class="inline">npm install -g noiracoder</code> und wird in eigener Verantwortung auf eigenen Projekten genutzt.',
  h3: 'Geistiges Eigentum',
  p3: 'Texte, Design und Code dieser Website gehören ihren Inhabern. Der NoiraCoder-Agent erzeugt oder ändert Code auf deinem Gerät: Dieser resultierende Code gehört dir.',
  h4: 'Externe Links',
  p4: 'Diese Website verlinkt auf Ökosystem-Seiten und Modellanbieter (Kilo, OpenRouter, Groq, Zen). Wir kontrollieren weder deren Inhalte noch Bedingungen.',
  h5: 'Haftung',
  p5: 'Der Agent führt Aktionen auf deinem Gerät aus (Dateien bearbeiten, Befehle ausführen), an sensiblen Stellen immer mit Bestätigung. Prüfe jede Änderung vor dem Veröffentlichen. Wir haften nicht für ohne Prüfung veröffentlichten Code.',
  h6: 'Anwendbares Recht',
  p6_html: 'Bei Streitigkeiten schreib uns zuerst an noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">Kontakt →</a>'
};
NOIRA_IT.legal2 = {
  h1: 'Titolarità',
  p1: 'NoiraCoder è un prodotto dell\u2019ecosistema Noira. Contatto: noiramaster@gmail.com. Ogni prodotto dell\u2019ecosistema è indipendente, con il proprio sito e condizioni.',
  h2: 'Oggetto',
  p2_html: 'Questo sito presenta NoiraCoder, un agente di codice nel terminale. Il software si installa con <code class="inline">npm install -g noiracoder</code> e si usa sotto la tua responsabilità nei tuoi progetti.',
  h3: 'Proprietà intellettuale',
  p3: 'Testi, design e codice di questo sito appartengono ai rispettivi titolari. L\u2019agente NoiraCoder genera o modifica codice sul tuo dispositivo: quel codice risultante ti appartiene.',
  h4: 'Link esterni',
  p4: 'Questo sito collega a siti dell\u2019ecosistema e provider di modelli (Kilo, OpenRouter, Groq, Zen). Non controlliamo i loro contenuti né condizioni.',
  h5: 'Responsabilità',
  p5: 'L\u2019agente esegue azioni sul tuo dispositivo (modificare file, lanciare comandi), sempre con conferma nei passaggi sensibili. Verifica ogni modifica prima di pubblicare. Non siamo responsabili del codice pubblicato senza revisione.',
  h6: 'Legge applicabile',
  p6_html: 'Per qualsiasi controversia, scrivici prima a noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">Contatti →</a>'
};
NOIRA_ES.contact.mother = 'Noiramaster (marca madre)';
NOIRA_EN.contact.mother = 'Noiramaster (mother brand)';
NOIRA_PT.contact.mother = 'Noiramaster (marca mãe)';
NOIRA_FR.contact.mother = 'Noiramaster (marque mère)';
NOIRA_DE.contact.mother = 'Noiramaster (Muttermarke)';
NOIRA_IT.contact.mother = 'Noiramaster (marchio madre)';
NOIRA_AR.contact.mother = 'Noiramaster (العلامة الأم)';
NOIRA_ES.sobre.h4 = 'Contacto';
NOIRA_EN.sobre.h4 = 'Contact';
NOIRA_PT.sobre.h4 = 'Contacto';
NOIRA_FR.sobre.h4 = 'Contact';
NOIRA_DE.sobre.h4 = 'Kontakt';
NOIRA_IT.sobre.h4 = 'Contatti';
NOIRA_AR.sobre.h4 = 'تواصل';

/* Tutoriales (Kilo primero, pantalla Go) */
NOIRA_ES.tuto = {
  s1t: 'Empieza sin claves',
  s1sub: 'Kilo anónimo funciona nada más instalar. Sin registro, sin tarjeta.',
  a1t: '1 · Abre la pantalla en tu proyecto',
  a1pre: 'cd mi-proyecto\nnoira --go',
  a2t: '2 · Pide tu primera tarea',
  a2pre: 'Escribe y pulsa Enter   # el motor elige modelo y rota solo si falla',
  s2t: 'Amplía tu cuota (opcional)',
  s2sub: 'Conecta claves solo si quieres más cuota. Cada una tarda ~1 min.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # se abre el navegador, 1 clic (OAuth)\n# o manual: https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (gratis, 1 min)\nnoira login --groq <tu-key>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (gratis, 1 min)\nnoira login --zen <tu-key>',
  vt: '✓ Verifica',
  vpre: 'noira connect   # valida cada provider con red real',
  s3t: 'Tu primera sesión',
  c1t: '1 · Streaming + confirmaciones',
  c1pre: '# la respuesta llega token a token; lo peligroso pide [y/n]',
  c2t: '2 · Sesiones y modos',
  c2pre: '/sessions   # listar\n/resume 1   # continuar\n/plan · /build   # solo lectura / ejecución',
  c3t: '3 · Modelo y salida',
  c3pre: '/model <id>   # cambiar modelo\nCtrl+C   # cancelar turno (otra vez para salir)'
};
NOIRA_EN.tuto = {
  s1t: 'Start with no keys',
  s1sub: 'Anonymous Kilo works right after install. No signup, no card.',
  a1t: '1 · Open the screen in your project',
  a1pre: 'cd my-project\nnoira --go',
  a2t: '2 · Ask your first task',
  a2pre: 'Type and press Enter   # the engine picks a model and rotates only on failure',
  s2t: 'Extend your quota (optional)',
  s2sub: 'Connect keys only if you want more quota. Each takes ~1 min.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # the browser opens, 1 click (OAuth)\n# or manual: https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (free, 1 min)\nnoira login --groq <your-key>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (free, 1 min)\nnoira login --zen <your-key>',
  vt: '✓ Verify',
  vpre: 'noira connect   # validates each provider over the real network',
  s3t: 'Your first session',
  c1t: '1 · Streaming + confirmations',
  c1pre: '# the answer streams token by token; dangerous stuff asks [y/n]',
  c2t: '2 · Sessions and modes',
  c2pre: '/sessions   # list\n/resume 1   # continue\n/plan · /build   # read-only / execution',
  c3t: '3 · Model and exit',
  c3pre: '/model <id>   # switch model\nCtrl+C   # cancel turn (again to quit)'
};
NOIRA_PT.tuto = {
  s1t: 'Começa sem chaves',
  s1sub: 'Kilo anónimo funciona logo após instalar. Sem registo, sem cartão.',
  a1t: '1 · Abre o ecrã no teu projeto',
  a1pre: 'cd meu-projeto\nnoira --go',
  a2t: '2 · Pede a tua primeira tarefa',
  a2pre: 'Escreve e prime Enter   # o motor escolhe o modelo e roda só em falha',
  s2t: 'Amplia a tua quota (opcional)',
  s2sub: 'Liga chaves só se quiseres mais quota. Cada uma demora ~1 min.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # o navegador abre, 1 clique (OAuth)\n# ou manual: https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (grátis, 1 min)\nnoira login --groq <tua-key>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (grátis, 1 min)\nnoira login --zen <tua-key>',
  vt: '✓ Verifica',
  vpre: 'noira connect   # valida cada provider com rede real',
  s3t: 'A tua primeira sessão',
  c1t: '1 · Streaming + confirmações',
  c1pre: '# a resposta chega token a token; o perigoso pede [y/n]',
  c2t: '2 · Sessões e modos',
  c2pre: '/sessions   # listar\n/resume 1   # continuar\n/plan · /build   # só leitura / execução',
  c3t: '3 · Modelo e saída',
  c3pre: '/model <id>   # mudar de modelo\nCtrl+C   # cancelar turno (outra vez para sair)'
};
NOIRA_FR.tuto = {
  s1t: 'Commence sans clés',
  s1sub: 'Kilo anonyme marche dès l\u2019installation. Sans inscription, sans carte.',
  a1t: '1 · Ouvre l\u2019écran dans ton projet',
  a1pre: 'cd mon-projet\nnoira --go',
  a2t: '2 · Demande ta première tâche',
  a2pre: 'Écris et appuie sur Entrée   # le moteur choisit le modèle et pivote seulement en cas d\u2019échec',
  s2t: 'Étends ton quota (optionnel)',
  s2sub: 'Connecte des clés seulement si tu veux plus de quota. Chacune prend ~1 min.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # le navigateur s\u2019ouvre, 1 clic (OAuth)\n# ou manuel : https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (gratuit, 1 min)\nnoira login --groq <ta-clé>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (gratuit, 1 min)\nnoira login --zen <ta-clé>',
  vt: '✓ Vérifie',
  vpre: 'noira connect   # valide chaque fournisseur sur le vrai réseau',
  s3t: 'Ta première session',
  c1t: '1 · Streaming + confirmations',
  c1pre: '# la réponse arrive token par token ; le dangereux demande [y/n]',
  c2t: '2 · Sessions et modes',
  c2pre: '/sessions   # lister\n/resume 1   # continuer\n/plan · /build   # lecture seule / exécution',
  c3t: '3 · Modèle et sortie',
  c3pre: '/model <id>   # changer de modèle\nCtrl+C   # annuler le tour (encore pour quitter)'
};
NOIRA_DE.tuto = {
  s1t: 'Starte ohne Schlüssel',
  s1sub: 'Anonymes Kilo läuft direkt nach der Installation. Ohne Registrierung, ohne Karte.',
  a1t: '1 · Öffne den Screen in deinem Projekt',
  a1pre: 'cd mein-projekt\nnoira --go',
  a2t: '2 · Stelle deine erste Aufgabe',
  a2pre: 'Schreiben und Enter drücken   # die Engine wählt das Modell und rotiert nur bei Fehlern',
  s2t: 'Erweitere dein Kontingent (optional)',
  s2sub: 'Verbinde Schlüssel nur für mehr Kontingent. Jeder dauert ~1 Min.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # der Browser öffnet sich, 1 Klick (OAuth)\n# oder manuell: https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (gratis, 1 Min)\nnoira login --groq <dein-key>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (gratis, 1 Min)\nnoira login --zen <dein-key>',
  vt: '✓ Prüfen',
  vpre: 'noira connect   # validiert jeden Provider im echten Netz',
  s3t: 'Deine erste Sitzung',
  c1t: '1 · Streaming + Bestätigungen',
  c1pre: '# die Antwort kommt Token für Token; Gefährliches fragt [y/n]',
  c2t: '2 · Sitzungen und Modi',
  c2pre: '/sessions   # auflisten\n/resume 1   # fortsetzen\n/plan · /build   # nur lesen / ausführen',
  c3t: '3 · Modell und Ausgang',
  c3pre: '/model <id>   # Modell wechseln\nStrg+C   # Zug abbrechen (nochmal zum Beenden)'
};
NOIRA_IT.tuto = {
  s1t: 'Inizia senza chiavi',
  s1sub: 'Kilo anonimo funziona subito dopo l\u2019installazione. Senza registrazione, senza carta.',
  a1t: '1 · Apri la schermata nel tuo progetto',
  a1pre: 'cd mio-progetto\nnoira --go',
  a2t: '2 · Chiedi il tuo primo compito',
  a2pre: 'Scrivi e premi Invio   # il motore sceglie il modello e ruota solo in caso di errore',
  s2t: 'Estendi la tua quota (opzionale)',
  s2sub: 'Collega chiavi solo se vuoi più quota. Ognuna richiede ~1 min.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # si apre il browser, 1 clic (OAuth)\n# o manuale: https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (gratis, 1 min)\nnoira login --groq <tua-key>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (gratis, 1 min)\nnoira login --zen <tua-key>',
  vt: '✓ Verifica',
  vpre: 'noira connect   # valida ogni provider sulla rete reale',
  s3t: 'La tua prima sessione',
  c1t: '1 · Streaming + conferme',
  c1pre: '# la risposta arriva token per token; ciò che è pericoloso chiede [y/n]',
  c2t: '2 · Sessioni e modalità',
  c2pre: '/sessions   # elenca\n/resume 1   # continua\n/plan · /build   # sola lettura / esecuzione',
  c3t: '3 · Modello e uscita',
  c3pre: '/model <id>   # cambia modello\nCtrl+C   # annulla il turno (di nuovo per uscire)'
};
NOIRA_AR.tuto = {
  s1t: 'ابدأ بدون مفاتيح',
  s1sub: 'Kilo المجهول يعمل فور التثبيت. بدون تسجيل، بدون بطاقة.',
  a1t: '1 · افتح الشاشة في مشروعك',
  a1pre: 'cd demo\nnoira --go',
  a2t: '2 · اطلب مهمتك الأولى',
  a2pre: 'اكتب واضغط Enter   # المحرك يختار النموذج ويدوّر فقط عند الفشل',
  s2t: 'وسّع حصتك (اختياري)',
  s2sub: 'اربط المفاتيح فقط إذا أردت حصة أكبر. كل مفتاح يستغرق دقيقة واحدة.',
  b1t: '1 · OpenRouter',
  b1pre: 'noira login   # يفتح المتصفح، نقرة واحدة (OAuth)\n# أو يدوياً: https://openrouter.ai/keys',
  b2t: '2 · Groq',
  b2pre: '# https://console.groq.com/keys (مجاني، 1 دقيقة)\nnoira login --groq <your-key>',
  b3t: '3 · Zen',
  b3pre: '# https://opencode.ai/zen (مجاني، 1 دقيقة)\nnoira login --zen <your-key>',
  vt: '✓ تحقق',
  vpre: 'noira connect   # يتحقق من كل مزود عبر الشبكة الحقيقية',
  s3t: 'جلستك الأولى',
  c1t: '1 · البث + التأكيدات',
  c1pre: '# تصل الإجابة رمزاً فرمزاً؛ الخطير يطلب [y/n]',
  c2t: '2 · الجلسات والأوضاع',
  c2pre: '/sessions   # عرض\n/resume 1   # متابعة\n/plan · /build   # قراءة فقط / تنفيذ',
  c3t: '3 · النموذج والخروج',
  c3pre: '/model <id>   # تغيير النموذج\nCtrl+C   # إلغاء الدور (مرة أخرى للخروج)'
};

/* Teasers que faltaban + sección skill propia */
NOIRA_ES.teasers.planning = 'Descompone la tarea, lista riesgos y pide confirmación antes de tocar código.';
NOIRA_ES.teasers.gitflow = 'Ramas, commits atómicos, PRs con contexto. Nunca pushea sin confirmación.';
NOIRA_ES.teasers.langexpert = 'Idioms del lenguaje del proyecto. Corrige patrones, no solo sintaxis.';
NOIRA_ES.teasers.docs = 'Documenta lo que cambió: README, porqués, ejemplos que compilan.';
NOIRA_ES.skillpage = {
  ownh: 'Skill propia',
  ownpre: '---\nname: mi-skill\ndescription: Cuándo debe usarme el agente\n---\n# Instrucciones expertas...'
};
NOIRA_EN.teasers.planning = 'Breaks down the task, lists risks and asks for confirmation before touching code.';
NOIRA_EN.teasers.gitflow = 'Branches, atomic commits, PRs with context. Never pushes without confirmation.';
NOIRA_EN.teasers.langexpert = 'Project language idioms. Fixes patterns, not just syntax.';
NOIRA_EN.teasers.docs = 'Documents what changed: README, rationales, compiling examples.';
NOIRA_EN.skillpage = {
  ownh: 'Own skill',
  ownpre: '---\nname: mi-skill\ndescription: When the agent should use me\n---\n# Expert instructions...'
};
NOIRA_PT.teasers.planning = 'Decompõe a tarefa, lista riscos e pede confirmação antes de tocar no código.';
NOIRA_PT.teasers.gitflow = 'Ramos, commits atómicos, PRs com contexto. Nunca faz push sem confirmação.';
NOIRA_PT.teasers.langexpert = 'Idiomatismos da linguagem do projeto. Corrige padrões, não só sintaxe.';
NOIRA_PT.teasers.docs = 'Documenta o que mudou: README, motivos, exemplos que compilam.';
NOIRA_PT.skillpage = {
  ownh: 'Skill própria',
  ownpre: '---\nname: mi-skill\ndescription: Quando o agente deve usar-me\n---\n# Instruções de especialista...'
};
NOIRA_FR.teasers.planning = 'Décompose la tâche, liste les risques et demande confirmation avant de toucher au code.';
NOIRA_FR.teasers.gitflow = 'Branches, commits atomiques, PR avec contexte. Ne pousse jamais sans confirmation.';
NOIRA_FR.teasers.langexpert = 'Idiotismes du langage du projet. Corrige les patterns, pas juste la syntaxe.';
NOIRA_FR.teasers.docs = 'Documente ce qui a changé : README, motifs, exemples qui compilent.';
NOIRA_FR.skillpage = {
  ownh: 'Skill perso',
  ownpre: '---\nname: mi-skill\ndescription: Quand l\u2019agent doit m\u2019utiliser\n---\n# Instructions expertes...'
};
NOIRA_DE.teasers.planning = 'Zerlegt die Aufgabe, listet Risiken und fragt vor Code-Änderungen um Bestätigung.';
NOIRA_DE.teasers.gitflow = 'Branches, atomare Commits, PRs mit Kontext. Pusht nie ohne Bestätigung.';
NOIRA_DE.teasers.langexpert = 'Idiome der Projektsprache. Korrigiert Muster, nicht nur Syntax.';
NOIRA_DE.teasers.docs = 'Dokumentiert was sich änderte: README, Begründungen, kompilierende Beispiele.';
NOIRA_DE.skillpage = {
  ownh: 'Eigener Skill',
  ownpre: '---\nname: mi-skill\ndescription: Wann mich der Agent nutzen soll\n---\n# Experten-Anweisungen...'
};
NOIRA_IT.teasers.planning = 'Scompone il compito, elenca i rischi e chiede conferma prima di toccare il codice.';
NOIRA_IT.teasers.gitflow = 'Branch, commit atomici, PR con contesto. Mai push senza conferma.';
NOIRA_IT.teasers.langexpert = 'Idiomi del linguaggio del progetto. Corregge i pattern, non solo la sintassi.';
NOIRA_IT.teasers.docs = 'Documenta cosa è cambiato: README, motivazioni, esempi che compilano.';
NOIRA_IT.skillpage = {
  ownh: 'Skill propria',
  ownpre: '---\nname: mi-skill\ndescription: Quando l\u2019agente deve usarmi\n---\n# Istruzioni esperte...'
};
NOIRA_AR.teasers.planning = 'يفكك المهمة ويسرد المخاطر ويطلب التأكيد قبل لمس الشيفرة.';
NOIRA_AR.teasers.gitflow = 'فروع وكوميتات ذرية وPRs بسياق. لا يدفع أبداً بدون تأكيد.';
NOIRA_AR.teasers.langexpert = 'أساليب لغة المشروع. يصحح الأنماط لا الصياغة فقط.';
NOIRA_AR.teasers.docs = 'يوثق ما تغير: README والأسباب وأمثلة تُترجم.';
NOIRA_AR.skillpage = {
  ownh: 'مهارة خاصة',
  ownpre: '---\nname: mi-skill\ndescription: متى يجب على الوكيل استخدامي\n---\n# تعليمات الخبراء...'
};

NOIRA_AR.legal2 = {
  h1: 'الملكية',
  p1: 'NoiraCoder منتج من منظومة Noira. التواصل: noiramaster@gmail.com. كل منتج في المنظومة مستقل، بموقعه وشروطه الخاصة.',
  h2: 'الموضوع',
  p2_html: 'يعرض هذا الموقع NoiraCoder، وكيل برمجة في الطرفية. يُثبت البرنامج عبر <code class="inline">npm install -g noiracoder</code> ويُستخدم تحت مسؤوليتك في مشاريعك الخاصة.',
  h3: 'الملكية الفكرية',
  p3: 'نصوص هذا الموقع وتصميمه وشيفرته ملك لأصحابها. يولّد وكيل NoiraCoder الشيفرة أو يعدلها على جهازك: تلك الشيفرة الناتجة ملك لك.',
  h4: 'روابط خارجية',
  p4: 'يربط هذا الموقع مواقع المنظومة ومزودي النماذج (Kilo، OpenRouter، Groq، Zen). لا نتحكم في محتوياتهم ولا شروطهم.',
  h5: 'المسؤولية',
  p5: 'ينفذ الوكيل إجراءات على جهازك (تحرير ملفات، تنفيذ أوامر) مع التأكيد دائماً في الخطوات الحساسة. راجع كل تغيير قبل النشر. لسنا مسؤولين عن شيفرة منشورة دون مراجعة.',
  h6: 'القانون المطبق',
  p6_html: 'لأي نزاع، اكتب إلينا أولاً على noiramaster@gmail.com. <a class="link-accent" href="/contacto.html">اتصل بنا →</a>'
};

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

/* Aplica idioma: <html lang dir> + [data-i18n] + placeholders + switchers.
 * Claves terminadas en _html se aplican como innerHTML (párrafos con enlaces);
 * el resto como texto. Los <pre> usan claves _pre con el texto completo. */
function noiraApplyLang(locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = noiraIsRTL(locale) ? 'rtl' : 'ltr';
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    var k = els[i].getAttribute('data-i18n');
    var v = noiraT(k, locale);
    var last = k.split('.').pop();
    if (k.slice(-5) === '_html' || last.slice(0, 3) === 'pre') els[i].innerHTML = v;
    else els[i].textContent = v;
  }
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
