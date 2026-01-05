// Test script to debug Google Sheets data
const https = require('https');
const fs = require('fs');

const SHEET_ID = '1fF8awRw7docOPw1BnY_ebx0YJPYVsW45CIVHPoYHmE0';
const GID = '1372502879';
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

let output = [];
output.push('Fetching from: ' + url);

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Extract JSON from JSONP response
        const jsonStr = data.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (!jsonStr || !jsonStr[1]) {
            output.push('Invalid response format');
            output.push('Raw response: ' + data.substring(0, 500));
            fs.writeFileSync('debug-output.txt', output.join('\n'));
            return;
        }

        const parsed = JSON.parse(jsonStr[1]);
        const cols = parsed.table.cols;
        const rows = parsed.table.rows;

        output.push('\n====== COLUMN HEADERS ======');
        cols.forEach((col, idx) => {
            output.push(`Column ${idx}: "${col.label}" (${col.type})`);
        });

        output.push('\n====== FIRST 3 DATA ROWS ======');
        for (let i = 0; i < Math.min(3, rows.length); i++) {
            const row = rows[i];
            output.push(`\nRow ${i + 1}:`);
            if (row.c) {
                row.c.forEach((cell, idx) => {
                    const header = cols[idx]?.label || `col${idx}`;
                    const value = cell ? (cell.v ?? cell.f ?? '') : '';
                    if (value) {
                        output.push(`  ${header}: ${value}`);
                    }
                });
            }
        }

        output.push(`\n====== TOTAL ROWS: ${rows.length} ======`);

        fs.writeFileSync('debug-output.txt', output.join('\n'));
        console.log('Output saved to debug-output.txt');
    });
}).on('error', err => {
    output.push('Error: ' + err.message);
    fs.writeFileSync('debug-output.txt', output.join('\n'));
});
