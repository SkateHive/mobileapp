#!/usr/bin/env node

const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v2/feed/vaipraonde/following',
    method: 'GET'
};

console.log('Testing following feed performance...');
const start = Date.now();

const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        const time = Date.now() - start;
        console.log(`\nStatus Code: ${res.statusCode}`);
        console.log(`Time taken: ${time}ms\n`);
        
        try {
            const json = JSON.parse(data);
            if (json.success) {
                console.log(`✅ Success! Fetched ${json.data.length} items`);
                if (json.data.length > 0) {
                    console.log('First item author:', json.data[0].author);
                    console.log('First item permlink:', json.data[0].permlink);
                }
            } else {
                console.log('❌ API reported failure:', json);
            }
        } catch (e) {
            console.log('❌ Failed to parse response:', data.substring(0, 500));
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error.message);
    if (error.code === 'ECONNREFUSED' && options.port === 3000) {
        console.log('Trying port 3001...');
        options.port = 3001;
        const retryReq = http.request(options, /* same logic */);
        retryReq.end();
    }
});

req.end();
