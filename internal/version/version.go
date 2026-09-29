package version

// Version is set at build time via -ldflags
var Version = "NoiraCoder 1.0.0"

// GitSha is set at build time via -ldflags (-X .../internal/version.GitSha).
// GATE E: check-release.mjs exige que los binarios de plataforma contengan
// el sha del commit HEAD a publicar; sin esto un bump pasaba con binarios
// viejos (0.2.0 vs 0.2.2). Sin ldflags vale "dev" y el gate falla (fail-closed).
var GitSha = "dev"
