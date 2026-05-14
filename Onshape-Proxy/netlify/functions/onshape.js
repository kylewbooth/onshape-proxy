// netlify/functions/onshape.js
// Netlify serverless function — proxies requests to OnShape API
// API keys are stored as Netlify environment variables, never in code
 
const https = require('https');
const crypto = require('crypto');
 
function buildAuthHeaders(method, path, queryString, contentType) {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey = process.env.ONSHAPE_SECRET_KEY;
  const date      = new Date().toUTCString();
  const nonce     = crypto.randomBytes(16).toString('hex');
 
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
    const contentType = 'application/json';
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
 
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
 
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
 
  const did = 'ea2e3173c11474027a950f47';
  const wid = 'e92ba12c29a8f30ac6e5974f';
  const eid = 'd2f1113cc69a582984eebe00';
  const action = event.queryStringParameters && event.queryStringParameters.action;
 
  try {
    if (event.httpMethod === 'GET' && action === 'getConfigurations') {
      const path = `/api/v6/partstudios/d/${did}/w/${wid}/e/${eid}/configuration`;
      const result = await onshapeRequest('GET', path, '', null);
      return {
        statusCode: result.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body),
      };
    }
 
    if (event.httpMethod === 'POST' && action === 'setConfiguration') {
      const body = JSON.parse(event.body || '{}');
      const { configurationId } = body;
 
      if (!configurationId) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'configurationId is required' }),
        };
      }
 
      const path = `/api/v6/partstudios/d/${did}/w/${wid}/e/${eid}/configuration`;
 
      // Get current config to find the parameter ID
      const getResult = await onshapeRequest('GET', path, '', null);
      if (getResult.status !== 200) {
        return {
          statusCode: getResult.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(getResult.body),
        };
      }
 
      const configInputs = getResult.body.configurationParameters || [];
      const listParam = configInputs.find(p => p.btType === 'BTMConfigurationParameterEnum-105');
 
      if (!listParam) {
        return {
          statusCode: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No configuration list found on this part' }),
        };
      }
 
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
      return {
        statusCode: setResult.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(setResult.body),
      };
    }
 
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unknown action' }),
    };
 
  } catch (err) {
    console.error('OnShape proxy error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
