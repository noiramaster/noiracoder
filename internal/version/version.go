package version

// Version is set at build time via -ldflags
var Version = "NoiraCoder 1.0.0"

// GitSha is set at build time via -ldflags (-X .../internal/version.GitSha).
// Solo procedencia informativa: el GATE E v2 ya NO lo comprueba (un rebase
// cambia el sha sin cambiar el contenido; ver GoContentHash).
var GitSha = "dev"

// GoContentHash is set at build time via -ldflags (-X .../internal/version.GoContentHash).
// GATE E v2 (TAREA HHH): sha256 del CONTENIDO Go (scripts/go-content-hash.mjs).
// check-release.mjs exige que los binarios contengan el hash del árbol actual;
// un rebase que no toque Go (p. ej. el blog) no lo invalida. Sin ldflags
// vale "dev" y el gate falla (fail-closed).
var GoContentHash = "dev"
