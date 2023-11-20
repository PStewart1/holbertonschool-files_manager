// contains all the endpoints of our API

import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const express = require('express');

const routesToUse = express.Router();

routesToUse.get('/status', AppController.getStatus);
routesToUse.get('/stats', AppController.getStats);
routesToUse.post('/users', UsersController.postNew);
routesToUse.get('/connect', AuthController.getConnect);
routesToUse.get('/disconnect', AuthController.getDisconnect);
routesToUse.get('/users/me', UsersController.getMe);
routesToUse.post('/files', FilesController.postUpload);
routesToUse.get('/files/:id', FilesController.getShow);
routesToUse.get('/files', FilesController.getIndex);

module.exports = routesToUse;
