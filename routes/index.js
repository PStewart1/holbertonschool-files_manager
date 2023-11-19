// contains all the endpoints of our API

import AppController from '../controllers/AppController'
const express = require('express');

const routesToUse = express.Router();

routesToUse.get('/status', AppController.getStatus);
// routesToUse.get('/stats', AppController.getStats);

module.exports = routesToUse;
