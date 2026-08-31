const express = require('express');
const path = require('path');

const root = path.join(__dirname, '..');
const app = express();
app.use('/app', express.static(path.join(root, 'src', 'renderer')));
app.use('/downloads', express.static(path.join(root, 'releases')));
app.use('/', express.static(path.join(root, 'website')));
app.listen(8099, '127.0.0.1');
