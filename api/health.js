const { isKvConfigured } = require("./_lib/kv");

module.exports = async function handler(_req, res) {
  res.status(200).json({
    ok: true,
    backend: true,
    kvConfigured: isKvConfigured(),
  });
};
