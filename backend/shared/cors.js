function getAllowedOrigin() {
  return process.env.CORS_ALLOW_ORIGIN || "*";
}

function withCorsHeaders(res) {
  const allowedOrigin = getAllowedOrigin();
  const headers = Object.assign({}, res.headers || {}, {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Max-Age": "86400"
  });

  return Object.assign({}, res, { headers });
}

function preflightResponse() {
  return withCorsHeaders({
    status: 204,
    body: ""
  });
}

module.exports = {
  withCorsHeaders,
  preflightResponse
};
