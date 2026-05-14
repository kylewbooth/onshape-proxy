// api/onshape.js
// Vercel serverless function — proxies requests to OnShape API
// API keys are stored as Vercel environment variables, never in code

const https = require('https');
const crypto = require('crypto');

// OnShape HMAC auth header builder
function buildAuthHeaders(method, path, queryString, contentType) {
  const accessKey  = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey  = process.env.ONSHAPE_SECRET_KEY;
  const date       = new Date().toUTCString();
  const nonce      = crypto.randomBytes(16).toString('hex');

  const hmacString = [
    method.toLowerCase(),
    nonce,
    date,
    contentType.toLowerCase(),
    path,
    queryString.toLowerCase(),
  ].join('\n') + '\n';

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(hmacString)
    .digest('base64');

  return {
    'Content-Type': contentType,
    'Date': date,
    'On-Nonce': nonce,
    'Authorization': `On ${accessKey}:HmacSHA256:${hmac}`,
    'Accept': 'application/json',
  };
}

function onshapeRequest(method, path, queryString, body) {
  return new Promise((resolve, reject) => {
    const contentType = body ? 'application/json' : 'application/json';
    const headers = buildAuthHeaders(method, path, queryString, contentType);
    const fullPath = queryString ? `${path}?${queryString}` : path;

    const options = {
      hostname: 'cad.onshape.com',
      path: fullPath,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = async (req, res) => {
  // CORS headers — must be set on every response including errors
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight immediately before anything else
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const did = 'ea2e3173c11474027a950f47';
  const wid = 'e92ba12c29a8f30ac6e5974f';
  const eid = 'd2f1113cc69a582984eebe00';

  try {
    if (req.method === 'GET' && req.query.action === 'getConfigurations') {
      // Fetch available configurations for the part
      const path = `/api/v6/partstudios/d/${did}/w/${wid}/e/${eid}/configuration`;
      const result = await onshapeRequest('GET', path, '', null);
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'POST' && req.query.action === 'setConfiguration') {
      // Set a configuration on the part
      const { configurationId } = req.body;
      if (!configurationId) {
        return res.status(400).json({ error: 'configurationId is required' });
      }

      const path = `/api/v6/partstudios/d/${did}/w/${wid}/e/${eid}/configuration`;

      // First get current configuration to find the parameter id
      const getResult = await onshapeRequest('GET', path, '', null);
      if (getResult.status !== 200) {
        return res.status(getResult.status).json(getResult.body);
      }

      const configInputs = getResult.body.configurationParameters || [];
      const listParam = configInputs.find(p => p.type === 'BTMConfigurationParameterEnum-105');

      if (!listParam) {
        return res.status(404).json({ error: 'No configuration list found on this part' });
      }

      // Build the POST body to set the selected option
      const postBody = {
        configurationParameters: [
          {
            btType: 'BTMConfigurationParameterEnum-105',
            parameterId: listParam.parameterId,
            parameterValue: configurationId,
          }
        ]
      };

      const setResult = await onshapeRequest('POST', path, '', postBody);
      return res.status(setResult.status).json(setResult.body);
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('OnShape proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
