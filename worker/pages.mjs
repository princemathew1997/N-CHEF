// Pages keeps the browser and API on one origin; the service binding is private.
export default {
  fetch(request, env) {
    return new URL(request.url).pathname.startsWith('/api/')
      ? env.API.fetch(request)
      : env.ASSETS.fetch(request);
  },
};
