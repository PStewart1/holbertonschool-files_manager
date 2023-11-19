// contains the controller for our app; i.e., what happens on the routes

const red = require('../utils/redis');
const deebee = require('../utils/db');
const { default: dbClient } = require('../utils/db');

class AppController {
    getStatus() {
        pass;
    }

    async getStats(req, res) {
        const userCount = await dbClient.nbUsers();
        const fileCount = await dbClient.nbFiles();
        return res.status(200).json({"users": userCount, "files": fileCount});
    }
}

module.exports = AppController;
