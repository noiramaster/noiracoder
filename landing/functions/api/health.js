/** Pages Function demo: GET /api/health → estado de la landing. */
export async function onRequest() {
  return Response.json({
    ok: true,
    project: "noiracoder",
    pages: "noiracoder.pages.dev",
    ts: new Date().toISOString(),
  });
}
