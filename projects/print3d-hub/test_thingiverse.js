const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env'));
const apiToken = env.THINGIVERSE_API_TOKEN;

const options = {
  hostname: 'api.thingiverse.com',
  path: '/popular?page=1&per_page=1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiToken}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log(Object.keys(json[0]));
    console.log("license is:", json[0].license);
  });
});

req.end();
