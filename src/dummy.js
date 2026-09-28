export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "afterlife-dummy" });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  },
};
