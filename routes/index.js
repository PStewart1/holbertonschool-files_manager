// contains all the endpoints of our API

const AppController = require('../controllers/AppController')
const express = require('express');

const routesToUse = express.Router();

routesToUse.get('/status', AppController.getStatus);
routesToUse.get('/stats', AppController.getStats);

module.exports = routesToUse;
