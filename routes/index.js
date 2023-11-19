// contains all the endpoints of our API

import AppController from '../controllers/AppController';
import UsersController from '../controllers/UserController';
// import AuthController from '../controllers/AuthController';

const express = require('express');

const routesToUse = express.Router();

routesToUse.get('/status', AppController.getStatus);
routesToUse.get('/stats', AppController.getStats);
routesToUse.post('/users', UsersController.postNew);
// routesToUse.get('/connect', AuthController.getConnect);
// routesToUse.get('/disconnect', AuthController.getDisconnect);
// routesToUse.get('/users/me', UsersController.getMe);


module.exports = routesToUse;
