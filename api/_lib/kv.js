const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvRequest(path, options = {}) {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error("KV is not configured");
  }

  const response = await fetch(`${KV_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KV request failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function kvGetJson(key) {
  const data = await kvRequest(`/get/${encodeURIComponent(key)}`);
  if (!data?.result) {
    return null;
  }

  try {
    return JSON.parse(data.result);
  } catch (error) {
    return null;
  }
}

async function kvSetJson(key, value) {
  const encoded = encodeURIComponent(JSON.stringify(value));
  return kvRequest(`/set/${encodeURIComponent(key)}/${encoded}`);
}

async function kvIncr(key) {
  const data = await kvRequest(`/incr/${encodeURIComponent(key)}`);
  return Number(data?.result || 0);
}

function isKvConfigured() {
  return Boolean(KV_URL && KV_TOKEN);
}

module.exports = {
  isKvConfigured,
  kvGetJson,
  kvSetJson,
  kvIncr,
};
